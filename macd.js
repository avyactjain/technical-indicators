const _                 = require('lodash');
var moment = require('moment-timezone');

let obj_new_tickers   = {};

//--------- cron scheduler to calculate macd every 30 mins ---------------

exports.fn_refresh_macd = async function (db){
    let obj_live        = await getLivePrice(db);
    let obj_macd         = await getMacdData(db);
    let is_market_open  = await isMarketOpen(db);
    obj_new_tickers     = await getNewTickers(db);

     if(!is_market_open && !_.isEmpty(obj_macd)){
        obj_macd_updated             = updateMacdData(obj_live,obj_macd);
        let arr_crossovers          = findCrossovers(obj_live, obj_macd, obj_macd_updated);
        let arr_sorted_crossovers   = _.sortBy(arr_crossovers, 'sort_order');
        let obj_final               = findTop10(arr_sorted_crossovers);

        //console.log(obj_new_tickers);
        console.log(obj_final);

        return Promise.props({
            //p1: db.child('analytics/_technicals/_rsi/_new').update(obj_new_tickers),
            //p2: db.child('analytics/screener/paid/rsi').set(obj_final)
        });
     }else{
         return "done";
     }
}


function updateMacdData(obj_live, obj_macd){
    const smooth_factor12 = 2/(12+1);
    const smooth_factor26 = 2/(26+1);
    const smooth_factor9  = 2/(9+1);

    obj_final = {}; 
    let hours_24_ago = moment().valueOf() - 86400000;

    for(var i in obj_live){
        temp = {};
        ticker = i;
        let last_udpate = obj_live[ticker].updated*1000;
        if(obj_macd[ticker] && (last_udpate > hours_24_ago)){

            let difference_ema_12_live_price = obj_live[ticker].last_price - obj_macd[ticker].ema_12;
            let difference_ema_26_live_price = obj_live[ticker].last_price - obj_macd[ticker].ema_26;
            
            let last_ema_difference = obj_macd[ticker].MACD;
            let ema_12 = ((difference_ema_12_live_price)*smooth_factor12) + obj_macd[ticker].ema_12;
            let ema_26 = ((difference_ema_26_live_price)*smooth_factor26) + obj_macd[ticker].ema_26;
            let ema_difference = ema_12 - ema_26;
            let ema_9  = ((ema_difference-last_ema_difference)*smooth_factor9) + obj_macd[ticker].ema_9_signal;

            temp['ema_12']                          =    ema_12;
            temp['ema_26']                          =    ema_26;
            temp['ema_9_signal']                    =    ema_9;
            temp['histogram']                       =    ema_difference-ema_9;
            temp['last_updated']                    =    {'.sv' : 'timestamp'}
            temp['MACD']                            =    ema_difference;
            temp['signal']                          =    ema_9;
            temp['symbol']                          =    ticker;
            obj_final[i]                            =    temp;
        }else{
            if((last_udpate > hours_24_ago)){
                storeNewTickers(ticker, obj_live[i].last_price);
            }
        }
    }
    //console.log(obj_final);
    return obj_final;
}

function findCrossovers(obj_live,obj_macd,obj_macd_updated){
    let arr_crossovers = [];

    for(var ticker in obj_macd_updated){
        let obj_macd_v1 = obj_macd_updated[ticker];
        let obj_macd_v0 = obj_macd[ticker];

        if(obj_macd_v0.histogram <= 0){
            if(obj_macd_v1.histogram > 0){
            //bullish crossover
            arr_crossovers.push({
                symbol : ticker,
                objectID : ticker,
                name : "💹 Bullish signal" + Math.round(obj_macd_v1.histogram),
                sort_order : -1*obj_live[ticker].volume_traded
            });
        }

        }
        else if(obj_macd_v0.histogram >= 0){
            if(obj_macd_v1.histogram<0){
            //bearish crossover
            arr_crossovers.push({
                symbol : ticker,
                objectID : ticker,
                name : "🔻 Bearish Signal" + Math.round(obj_sma_v1.histogram),
                sort_order : -1*obj_live[ticker].volume_traded
            });
        }
    }
    }

    if(arr_crossovers.length === 0){
        arr_crossovers.push({
            symbol      : 'NIFTY',
            objectID    : 'NIFTY',
            name        : "No Crossover found",
            sort_order  : 1
        });
    }
    return arr_crossovers;
}



function getLivePrice(db){
    return db.child('symbols/NSE')
    .once('value')
            .then(snapshot => {
                return snapshot.val();
            });
}


function getMacdData(db){
    return db.child('analytics/_technicals/_macd/_hist')
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


function findCrossovers(obj_live,obj_macd,obj_macd_updated){
    let arr_crossovers = [];

    for(var ticker in obj_macd_updated){
        let obj_macd_v1 = obj_macd_updated[ticker];
        let obj_macd_v0 = obj_macd[ticker];
        //console.log(obj_macd_v1.histogram);

        if(obj_macd_v0.histogram <= 0){
            if(obj_macd_v1.histogram > 0){
            //bullish crossover
            arr_crossovers.push({
                symbol : ticker,
                objectID : ticker,
                name : "💹 Bullish signal " + (obj_macd_v1.histogram),
                sort_order : -1*obj_live[ticker].volume_traded
            });
        }
        }
        else if(obj_macd_v0.histogram >= 0){
            if(obj_macd_v1.histogram<0){
            //bearish crossover
            arr_crossovers.push({
                symbol : ticker,
                objectID : ticker,
                name : "🔻 Bearish Signal " + (obj_macd_v1.histogram),
                sort_order : -1*obj_live[ticker].volume_traded
            });
        }
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

function storeNewTickers(ticker, last_price){
    obj_new_tickers[ticker] = {
        last_price : last_price,
        last_updated : {'.sv' : 'timestamp'}
    }
}

