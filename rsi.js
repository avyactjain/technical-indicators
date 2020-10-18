const Promise   = require('bluebird');
const _         = require('lodash');
const moment    = require('moment');
let obj_new_tickers   = {};


function getLivePrice(db){
    return db.child('symbols/NSE').once('value')
            .then(snapshot => {
                return snapshot.val();
            });
}

async function calculateRSIData(db, ticker, live_price, exchange='NSE'){
    let obj_last_15_days_data = await db.child('charts/historical/' + exchange + "/" + ticker).limitToLast(15)
                                        .once('value')
                                        .then(snapshot => {
                                            if(snapshot.exists()){
                                                return snapshot.val();
                                            }else{
                                                return {};
                                            }
                                        });
    let arr_days = Object.keys(obj_last_15_days_data);
    let sumGain = 0;
    let sumLoss = 0;
    let lastGain = 0;
    let lastLoss = 0;
                                    
    for(var i=1; i < arr_days.length; i++){
    
        let obj_hist_data_i   = obj_last_15_days_data[arr_days[i]];
        let obj_hist_data_i_1 = obj_last_15_days_data[arr_days[i-1]];
        let difference        = obj_hist_data_i.close - obj_hist_data_i_1.close;
        sumGain = difference >= 0 ? sumGain + difference : sumGain;
        sumLoss = difference >= 0 ? sumLoss : sumLoss - difference;

        if(i === arr_days.length - 1){
            difference = live_price - obj_hist_data_i.close;
            lastGain   = difference >= 0 ? lastGain + difference : lastGain;
            lastLoss   = difference >= 0 ? lastLoss : lastLoss - difference;
        }
    }

    sumGain = sumGain/14;
    sumLoss = sumLoss/14;

    let smoothRS = sumGain/sumLoss; //(sumGain*13 + lastGain)/(sumLoss*13 + lastLoss);
    let RSI      = 100 - (100/(1+smoothRS));

    return {
        avgGain : sumGain,
        avgLoss : sumLoss,
        ticker  : ticker,
        RSI     : RSI ? Math.round(RSI*100)/100 : -1,
        closePrice : arr_days.length > 1 ? obj_last_15_days_data[arr_days[arr_days.length-1]].close : 0
    }
}

async function save(array_obj_rsi, db){
    let obj_final = {};
    array_obj_rsi.forEach(obj_rsi => {
        obj_rsi.last_update = {'.sv' : 'timestamp'};
        obj_final[obj_rsi.ticker] = obj_rsi;
    });

    return db.child('analytics/_technicals/_rsi/_hist').set(obj_final);
}

//run this function, if you want to reset everything.
exports.calculateHistoricRSI = async function(db){

    let obj_live_prices = await getLivePrice(db);
    let arr_tickers     = Object.keys(obj_live_prices);
    let arr_promises    = [];

    for(var i=0; i < arr_tickers.length; i++){
        let ticker = arr_tickers[i];
        let exchange   = obj_live_prices[ticker].exchange  
        let live_price = obj_live_prices[ticker].last_price 

        let p = calculateRSIData(db, ticker, live_price, exchange);
        arr_promises.push(p);
    }

    Promise.all(arr_promises)
    .then(arr_results => {
        return save(arr_results, db);
    })

}

//run this function at the end of day to update RSI values for next day calculations
exports.fn_update_rsi = async function (db){
    let obj_live        = await getLivePrice(db);
    let obj_rsi         = await getRSIData(db);
    let is_market_open  = await isMarketOpen(db);

    if(!is_market_open && !isEmpty(obj_rsi)){
        let obj_rsi_updated             = updateRSIData(obj_live,obj_rsi);
        return Promise.props({
            p1: db.child('analytics/_technicals/_rsi/_hist').update(obj_rsi_updated)
        });
    }else{
        return "done";
    }
}

//--------- cron scheduler to calculate RSI every 30 mins ---------------
exports.fn_refresh_rsi = async function (db){
    let obj_live        = await getLivePrice(db);
    let obj_rsi         = await getRSIData(db);
    let is_market_open  = await isMarketOpen(db);
    obj_new_tickers     = await getNewTickers(db);

    if(is_market_open && !isEmpty(obj_rsi)){
        let obj_rsi_updated             = updateRSIData(obj_live,obj_rsi);
        let arr_crossovers          = findCrossovers(obj_live, obj_rsi, obj_rsi_updated);
        let arr_sorted_crossovers   = _.sortBy(arr_crossovers, 'sort_order');
        let obj_final               = findTop10(arr_sorted_crossovers);

        console.log(obj_new_tickers);
        console.log(obj_final);

        return Promise.props({
            p1: db.child('analytics/_technicals/_rsi/_new').update(obj_new_tickers),
            p2: db.child('analytics/screener/paid/rsi').set(obj_final)
        });
    }else{
        return "done";
    }
}

function getRSIData(db){
    return db.child('analytics/_technicals/_rsi/_hist')
    .once('value')
    .then(snapshot => {
        if(snapshot.exists()){
            return snapshot.val();
        }else{
            return {};
        }
    })
}

function isMarketOpen(db){
    return db.child('_services/_marketstatus')
            .once('value')
            .then(snapshot => {
                if(snapshot.val() === 'open'){
                    return true;
                }else{
                    return false;
                }
            });
}

function getNewTickers(db){
    return db.child('analytics/_technicals/_rsi/_new')
    .once('value')
    .then(snapshot => {
        if(snapshot.exists()){
            return snapshot.val();
        }else{
            return {};
        }
    })

}

function isEmpty(obj_json){
    for(var key in obj_json){
        if(obj_json.hasOwnProperty(key)){
            return false;
        }
    }

    return true;
}

function updateRSIData(obj_live, obj_rsi){
    obj_final = {}; 
    let hours_24_ago = moment().valueOf() - 86400000; 
    for(var i in obj_live){
        temp = {};
        ticker = i;
        let last_udpate = obj_live[ticker].updated*1000;
        if(obj_rsi[ticker] && (last_udpate > hours_24_ago)){

            let difference = obj_live[ticker].last_price - obj_rsi[ticker].closePrice;
            let lastGain   = difference >= 0 ? difference : 0;
            let lastLoss   = difference >= 0 ? 0 : -1*difference;
            let smoothRS   = (obj_rsi[ticker].avgGain*13 + lastGain)/(obj_rsi[ticker].avgLoss*13 + lastLoss);
            let RSI        = 100 - (100/(1+smoothRS));

            temp['RSI']             = RSI ? Math.round(RSI*100)/100 : -1;
            temp['avgGain']         = (obj_rsi[ticker].avgGain*13 + lastGain)/14;
            temp['avgLoss']         = (obj_rsi[ticker].avgLoss*13 + lastLoss)/14;
            temp['closePrice']      = obj_live[ticker].last_price;
            temp['last_updated']    = {'.sv' : 'timestamp'}
            temp['symbol']          = ticker;
            obj_final[i]         = temp;
        }else{
            if((last_udpate > hours_24_ago)){
                storeNewTickers(ticker, obj_live[i].last_price);
            }
        }
    }
    return obj_final;
}

function storeNewTickers(ticker, last_price){
    obj_new_tickers[ticker] = {
        last_price : last_price,
        last_updated : {'.sv' : 'timestamp'}
    }
}

function findCrossovers(obj_live, obj_sma, obj_sma_updated){
    let arr_crossovers = [];

    //obj_sma_updated has least amount of ticker. and guranted to find results in obj_sma, obj_live
    for(var ticker in obj_sma_updated){
        let obj_sma_v1 = obj_sma_updated[ticker];
        let obj_sma_v0 = obj_sma[ticker];
        if(obj_sma_v1.RSI >= 70){
            //bullish crossover
            arr_crossovers.push({
                symbol : ticker,
                objectID : ticker,
                name : "💹 Overbought RSI ~" + Math.round(obj_sma_v1.RSI),
                sort_order : -1*obj_live[ticker].volume_traded
            });
        }
        else if(obj_sma_v1.RSI <= 30){
            //bearish crossover
            arr_crossovers.push({
                symbol : ticker,
                objectID : ticker,
                name : "🔻 Oversold RSI ~" + Math.round(obj_sma_v1.RSI),
                sort_order : -1*obj_live[ticker].volume_traded
            });
        }
    }

    if(arr_crossovers.length === 0){
        arr_crossovers.push({
            symbol      : 'NIFTY',
            objectID    : 'NIFTY',
            name        : "No oversold/bought found",
            sort_order  : 1
        });
    }

    return arr_crossovers;
}

function findTop10(arr_sorted_crossovers){
    let length = arr_sorted_crossovers.length > 10? 10: arr_sorted_crossovers.length;
    let obj_final = {};
    for (var i =0 ; i < length; i++){
        let obj = arr_sorted_crossovers[i];
        obj_final[obj.symbol] = obj;
    }

    return obj_final;
}
