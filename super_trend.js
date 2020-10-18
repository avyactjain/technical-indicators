const _                 = require('lodash');
var moment = require('moment-timezone');
var sma = require('sma');

const atr_parameter  = 10;
const factor_upper_basicBand = 3;
const factor_lower_basicBand = 3;

exports.getSuperTrend = async function(db,ticker){
    obj_superTrend = {};
    obj_live                                =       await getLivePrice(db);
    exchange                                =       obj_live[ticker].exchange;
    historical_data                         =       await getHistoricalData(db,ticker,exchange);
    arr_atr                                 =       calculateATR(historical_data); //calculate the atr arr. 11th close price will have the first atr
    basicbands                              =       calculateBasicBands(historical_data,arr_atr);
    bands                                   =       calculateBands(basicbands);
    supertrend                              =       calculateSuperTrend(bands);


    obj_superTrend['prev_atr']              =       supertrend['atr'][supertrend['atr'].length - 1];
    obj_superTrend['prev_close']            =       supertrend['closePrices'][supertrend['closePrices'].length - 1];
    obj_superTrend['prev_lowerBand']        =       supertrend['lowerBand'][supertrend['lowerBand'].length - 1];
    obj_superTrend['prev_upperBand']        =       supertrend['upperBand'][supertrend['upperBand'].length - 1];
    obj_superTrend['prev_superTrend']       =       supertrend['superTrend'][supertrend['superTrend'].length - 1];
    obj_superTrend['signal']                =       supertrend['superTrend'][supertrend['superTrend'].length - 1] >= supertrend['closePrices'][supertrend['closePrices'].length - 1] ? 'SELL' : 'BUY'
    
    console.log(obj_superTrend);
    return(obj_superTrend);
}

function calculateSuperTrend(bands){
    let arr_superTrend = [];
    for(i = 0; i < bands['upperBand'].length ; i++){

        if(arr_superTrend.length == 0){
            arr_superTrend.push(bands['upperBand'][i]);
        }
        else if(arr_superTrend[i-1] == bands['upperBand'][i-1] && bands['closePrices'][atr_parameter + i] <= bands['upperBand'][i]){
            arr_superTrend.push(bands['upperBand'][i]);
        }
        else if(arr_superTrend[i-1] == bands['upperBand'][i-1] && bands['closePrices'][atr_parameter + i] >= bands['upperBand'][i]){
            arr_superTrend.push(bands['lowerBand'][i]);
        }
        else if(arr_superTrend[i-1] == bands['lowerBand'][i-1] && bands['closePrices'][atr_parameter + i] >= bands['lowerBand'][i]){
            arr_superTrend.push(bands['lowerBand'][i]);
        }
        else if(arr_superTrend[i-1] == bands['lowerBand'][i-1] && bands['closePrices'][atr_parameter + i] <= bands['lowerBand'][i]){
            arr_superTrend.push(bands['upperBand'][i]);
        }
        else{
            arr_superTrend.push('no_signal');
        }
    }
    obj_final = bands;
    obj_final['superTrend'] = arr_superTrend;
    return obj_final;
}

function calculateBands(basicbands){
    //COMPLEX LOGIC, DO NOT TOUCH!
     let arr_upperband = [];
     let arr_lowerband = [];

     for(i = 0  ; i < basicbands['upperBasicBand'].length ; i++){
         if(arr_upperband.length == 0){
            arr_upperband.push(basicbands['upperBasicBand'][i]);
         }

         else if(basicbands['upperBasicBand'][i] < arr_upperband[i-1] || basicbands['closePrices'][i+atr_parameter-1]>arr_upperband[i-1]){
             arr_upperband.push(basicbands['upperBasicBand'][i]);
         }

         else{
             arr_upperband.push(arr_upperband[i-1]);
         }
     }

     for(i = 0  ; i < basicbands['lowerBasicBand'].length ; i++){
        if(arr_lowerband.length == 0){
           arr_lowerband.push(basicbands['lowerBasicBand'][i]);
        }

        else if(basicbands['lowerBasicBand'][i] > arr_lowerband[i-1] || basicbands['closePrices'][i+atr_parameter-1]<arr_lowerband[i-1]){
            arr_lowerband.push(basicbands['lowerBasicBand'][i]);
        }

        else{
            arr_lowerband.push(arr_lowerband[i-1]);
        }
    }
    obj_final = basicbands;
    obj_final['upperBand'] = arr_upperband;
    obj_final['lowerBand'] = arr_lowerband;
    return obj_final;
}

function calculateBasicBands(historical_data, arr_atr){
    let obj_final = {};
    let starting_index = atr_parameter;
    let arr_highPrices = historical_data['highPrices'].slice(starting_index);
    let arr_lowPrices  = historical_data['lowPrices'].slice(starting_index);
    let arr_closePrices = historical_data['closePrices'];
    let arr_upperBasicBand = [];
    let arr_lowerBasicBand = [];

    for(i = 0; i < arr_lowPrices.length ; i++){
        let av_high_low = (arr_highPrices[i] + arr_lowPrices[i])/2;
        let temp_upper = av_high_low + (arr_atr[i] * factor_upper_basicBand);
        let temp_lower = av_high_low - (arr_atr[i] * factor_lower_basicBand);
        arr_upperBasicBand.push(temp_upper);
        arr_lowerBasicBand.push(temp_lower);
    }

    obj_final['lowerBasicBand']         = arr_lowerBasicBand;
    obj_final['upperBasicBand']         = arr_upperBasicBand;
    obj_final['closePrices']            = arr_closePrices;
    obj_final['atr']                    = arr_atr;
    return obj_final;
}

async function getHistoricalData(db, ticker, exchange){
    historicaldata_ = db.child('charts/5MINS/' + exchange + '/' + ticker).limitToLast(500).once('value').then(
        snap => {
            let obj_final       =         {};
            let closePrices     =         [];
            let openPrices      =         [];
            let lowPrices       =         [];
            let highPrices      =         [];
            snap.forEach(function(date){
                if(date.val().close && date.val().open && date.val().low && date.val().high)
                {
                closePrices.push(date.val().close);
                openPrices.push(date.val().open);
                lowPrices.push(date.val().low);
                highPrices.push(date.val().high);
                }
                
            })
            obj_final['closePrices']    =   closePrices;
            obj_final['openPrices']     =   openPrices;
            obj_final['lowPrices']      =   lowPrices;
            obj_final['highPrices']     =   highPrices;
            return obj_final;
        }
    )
    return historicaldata_;
}

function calculateATR(historical_data){
    let arr_trueRange = [];
    let arr_atr = [];
    for (i = 1; i < historical_data['closePrices'].length ; i++){

        arr_temp = [];
        high_minus_low = historical_data['highPrices'][i] - historical_data['lowPrices'][i];
        high_minus_prevClose = historical_data['highPrices'][i] - historical_data['closePrices'][i-1];
        low_minus_prevClose = historical_data['lowPrices'][i] - historical_data['closePrices'][i-1];

        arr_temp.push(Math.abs(high_minus_low));
        arr_temp.push(Math.abs(high_minus_prevClose));
        arr_temp.push(Math.abs(low_minus_prevClose));


        arr_trueRange.push(Math.max.apply(Math, arr_temp));
        arr_atr = sma(arr_trueRange,atr_parameter);
    }
    return arr_atr;  
}


function getLivePrice(db){
    return db.child('symbols/NSE/')
    .once('value')
            .then(snapshot => {
                return snapshot.val();
            });
}