const _                 = require('lodash');
const Promise           = require('bluebird');
const moment            = require('moment');

const atr_parameter  = 10;
const factor_upper_basicBand = 3;
const factor_lower_basicBand = 3;

let obj_new_tickers   = {};

//--------- cron scheduler to calculate SuperTrend every 30 mins ---------------

exports.fn_refresh_SuperTrend = async function (db){
    let obj_live               = await getLivePrice(db);
    console.log(obj_live);
    //console.log(obj_live);
    let obj_superTrend         = await getSuperTrendData(db);
    //console.log(obj_superTrend);
    let is_market_open         = await isMarketOpen(db);
    obj_new_tickers            = await getNewTickers(db);

     if(!is_market_open && !_.isEmpty(obj_superTrend)){
        //console.log('hi');
        obj_superTrend_updated                      = updateSupertrend(obj_live, obj_superTrend)
        console.log(obj_superTrend_updated);
        //let arr_crossovers                          = findCrossovers(obj_live, obj_superTrend, obj_superTrend_updated);
        //let arr_sorted_crossovers                   = _.sortBy(arr_crossovers, 'sort_order');
        //let obj_final                               = findTop10(arr_sorted_crossovers);

        // console.log(obj_final);

        // return Promise.props({
        //     p1: db.child('analytics/_technicals/_supertrend/_new').update(obj_new_tickers),
        //     p2: db.child('analytics/screener/paid/supertrend').set(obj_final)
        // });
     }else{
         return "done";
     }
}

exports.fn_update_supertrend = async function (db){
    let obj_live               = await getLivePrice(db);
    let obj_superTrend         = await getSuperTrendData(db);
    let is_market_open         = await isMarketOpen(db);
    obj_new_tickers            = await getNewTickers(db);

     if(!is_market_open && !isEmpty(obj_superTrend)){
        obj_supertrend_updated   = updateSupertrend(obj_live, obj_superTrend)
        // return Promise.props({
        //     p1: db.child('analytics/_technicals/_supertrend/_hist/').update(obj_supertrend_updated)
        // });
     }else{
         return "done";
     }
}

function updateSupertrend(obj_live, obj_supertrend){
    let obj_final = {}; 
    let hours_24_ago = moment().valueOf() - 86400000;

    for(var i in obj_live){
        temp = {};
        ticker = i;

        let last_udpate = obj_live[ticker].updated*1000;
        console.log(ticker);
        console.log('==========');
        if(obj_supertrend[ticker] && (last_udpate > hours_24_ago)){
            var prev_close                                   =         obj_supertrend[i].prev_close;
            console.log('prev_close ----->', prev_close);	
            var prev_atr                                     = 	       obj_supertrend[i].prev_atr; 
            console.log('prev_atr ----->', prev_atr);
            var prev_upperBand                               = 	       obj_supertrend[i].prev_upperBand;
            console.log('prev_upperband ----->', prev_upperBand);
            var prev_lowerBand                               =         obj_supertrend[i].prev_lowerBand;
            console.log('prev_lowerband ----->', prev_lowerBand);
            var prev_superTrend                              = 	       obj_supertrend[i].prev_superTrend;
            console.log('prev_supertrend ----->', prev_superTrend);
            
            var live                                         =         obj_live[i].last_price; 
            console.log('live ----->', live);
            var low                                          =         obj_live[i].day_low;	
            console.log('low ----->', low);
            var high                                         =         obj_live[i].day_high;
            console.log('high ----->', high);
    
            let upperBand       = prev_upperBand;
            let lowerBand       = prev_lowerBand;
            let superTrend      = 0;
    
            let tr              = _.max([high - low, Math.abs(high - prev_close), Math.abs(low - prev_close)]);
            console.log('tr ----->', tr);
            let updatedATR      = (prev_atr*(atr_parameter-1) + tr)/atr_parameter;
            console.log('updatedATR ----->', updatedATR);
            let upper_basicBand = ((high+low)/2) + (updatedATR * factor_upper_basicBand);
            console.log('upper_basicBand ----->', upper_basicBand);
            let lower_basicBand = ((high+low)/2) - (updatedATR * factor_lower_basicBand);
            console.log('lower_basicBand ----->', lower_basicBand);

            if(upper_basicBand < prev_upperBand || prev_close > prev_upperBand){
                upperBand = upper_basicBand;
            }
            
            if(lower_basicBand > prev_lowerBand || prev_close < prev_lowerBand){
                lowerBand = lower_basicBand;
            }

            if(prev_superTrend == prev_upperBand && live <= upperBand){
                superTrend = upperBand;
            }else if(prev_superTrend == prev_upperBand && live >= upperBand){
                superTrend = lowerBand;
            }else if(prev_superTrend == prev_lowerBand && live <= lowerBand){
                superTrend = lowerBand;
            }else if(prev_superTrend == prev_lowerBand && live >= lowerBand){
                superTrend = upperBand;
            }

            if (superTrend > live){   
                signal = 'SELL';
            }else if ( superTrend < live){
                signal = 'BUY';
            }

            obj_final[ticker] = {
                prev_atr        : updatedATR,
                prev_close      : live,
                prev_lowerBand  : lowerBand,
                prev_signal     : signal,
                prev_superTrend : superTrend,
                prev_upperBand  : upperBand
            }
    
        }else{
            if((last_udpate > hours_24_ago)){
                storeNewTickers(ticker, obj_live[i].last_price);
            }
        }
    }
    return obj_final;
}

function findCrossovers(obj_live,obj_macd,obj_macd_updated){
    let arr_crossovers = [];
    
    for(var ticker in obj_macd_updated){
        let obj_macd_v1 = obj_macd_updated[ticker];
        let obj_macd_v0 = obj_macd[ticker];

        if(obj_macd_v0.prev_superTrend >= obj_macd_v0.prev_close){
            if(obj_macd_v1.prev_superTrend <= obj_macd_v1.prev_close){
                //bullish crossover
            arr_crossovers.push({
                symbol      : ticker,
                objectID    : ticker,
                name        : "Forecast 🍏 Supertrend",
                sort_order  : -1*obj_live[ticker].volume_traded,
                updated     : moment().valueOf()
            });
        }
        }
        else if(obj_macd_v0.prev_superTrend <= obj_macd_v0.prev_close){
            if(obj_macd_v1.prev_superTrend >= obj_macd_v1.prev_close){

            //bearish crossover
            arr_crossovers.push({
                symbol      : ticker,
                objectID    : ticker,
                name        : "Forecast 🍎 Supertrend",
                sort_order  : -1*obj_live[ticker].volume_traded,
                updated     : moment().valueOf() 
            });
        }
    }
    }

    if(arr_crossovers.length === 0){
        arr_crossovers.push({
            symbol      : 'NIFTY',
            objectID    : 'NIFTY',
            name        : "No supertrend found",
            sort_order  : 1
        });
    }
    return arr_crossovers;
}


function updateSuperTrendData(obj_live, obj_superTrend){
    let obj_final = {};

    for(i in obj_live){
        let ticker = i;
        let temp = {};

        if(obj_superTrend[i]){
        var prev_close                                   =         obj_superTrend[i].prev_close;	
        var prev_atr                                     = 	       obj_superTrend[i].prev_atr; 
        var prev_signal                                  =         obj_superTrend[i].prev_signal; 
        var prev_upperBand                               = 	       obj_superTrend[i].prev_upperBand;
        var prev_lowerBand                               =         obj_superTrend[i].prev_lowerBand;
        var prev_superTrend                              = 	       obj_superTrend[i].prev_superTrend;

        var live                                         =         obj_live[i].last_price;          
        var low                                          =         obj_live[i].day_low;	
        var high                                         =         obj_live[i].day_high;

        let upperBand       = 0;
        let lowerBand       = 0;
        let superTrend      = 0;
        let signal          = 'none';
        let band_flip       = 'NO';

        let tr = _.max([high - low, Math.abs(high - prev_close), Math.abs(low - prev_close)]);

        let updatedATR = (prev_atr*(atr_parameter-1) + tr)/atr_parameter;
        let upper_basicBand = ((high+low)/2) + (updatedATR * factor_upper_basicBand);
        let lower_basicBand = ((high+low)/2) - (updatedATR * factor_lower_basicBand);

        if(upper_basicBand < prev_upperBand || prev_close > prev_upperBand){
            upperBand = upper_basicBand;
        }else{
            upperBand = prev_upperBand;
        }
        
        if(lower_basicBand > prev_lowerBand || prev_close < prev_lowerBand){
            lowerBand = lower_basicBand;
        }else{
            lowerBand = prev_lowerBand;
        }

        if(prev_superTrend == prev_upperBand && live <= upperBand){
            superTrend = upperBand;
        }else if(prev_superTrend == prev_upperBand && live >= upperBand){
            superTrend = lowerBand;
        }else if(prev_superTrend == prev_lowerBand && live <= lowerBand){
            superTrend = lowerBand;
        }else if(prev_superTrend == prev_lowerBand && live >= lowerBand){
            superTrend = upperBand;
        }else{
            superTrend = 0;
        }


        if (superTrend > live){   
            signal = '🔻 SELL';
        }else if ( superTrend < live){
            signal = '💹 BUY';
        }

        if(prev_signal == 'SELL' && signal == 'BUY'){
            band_flip = 'YES 💹 (Sell to Buy)';
        }else if(prev_signal == 'BUY' && signal == 'SELL'){
            band_flip = 'YES 🔻 (Buy to Sell)';
        }
        
        temp['symbol']                                                      = ticker;
        temp['objectID']                                                    = ticker;
        temp['sort_order']                                                  = (obj_live[i].volume_traded == 0) ? 0 : -1*(obj_live[i].volume_traded); 
        temp['name']                                                        = signal + ' ' + superTrend.toString();
        temp['band_flip']                                                   = band_flip;

        if(band_flip!='NO'){
            obj_final[ticker] = temp;
        }
       
    }else{
        storeNewTickers(ticker, obj_live[i].last_price);
    }
}

    if(_.isEmpty(obj_final)){
        obj_final['NIFTY'] = {
            symbol      : 'NIFTY',
            objectID    : 'NIFTY',
            name        : "No supertrend found",
            sort_order  : 1
        }
    }
    return obj_final;
}


function getSuperTrendData(db){
    return db.child('analytics/_technicals/_supertrend/_hist/')
    .once('value')
    .then(snapshot => {
        if(snapshot.exists()){
            return snapshot.val();
        }else{
            return {};
        }
    })
}

function getLivePrice(db){
    return db.child('symbols/NSE/')
    .once('value')
            .then(snapshot => {
                return snapshot.val();
            });
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

function findTop10(sorted_arr_superTrend_updated){
    let length = sorted_arr_superTrend_updated.length > 15? 15: sorted_arr_superTrend_updated.length;
    let obj_final = {};
    for (var i =0 ; i < length; i++){
        let obj = sorted_arr_superTrend_updated[i];
        obj_final[obj.symbol] = obj;
    }
    return obj_final;
}

function getNewTickers(db){
    return db.child('analytics/_technicals/_supertrend/_new')
    .once('value')
    .then(snapshot => {
        if(snapshot.exists()){
            return snapshot.val();
        }else{
            return {};
        }
    })
}

function storeNewTickers(ticker, last_price){
    obj_new_tickers[ticker] = {
        last_price : last_price,
        last_updated : {'.sv' : 'timestamp'}
    }
}

function isEmpty(obj_json){
    for(var key in obj_json){
        if(obj_json.hasOwnProperty(key)){
            return false;
        }
    }

    return true;
}
