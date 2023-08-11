'use strict';
const mongodb = require('mongodb')
const mongoose = require('mongoose')
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest

module.exports = function (app) {
  const API_KEY = process.env.API_KEY;
  let uri = 'mongodb+srv://venkyroxx99:'+ process.env.pw + '@cluster0.ze2nbpb.mongodb.net/fcc-stocks?retryWrites=true&w=majority'
  
  mongoose.connect(uri, {useNewUrlParser: true, useUnifiedTopology : true})
  
  let stockSchema = new mongoose.Schema({
    name: {type: String, required: true},
    likes: {type: Number, default: 0},
    ips: [String]
  })
  
  let Stock = mongoose.model('Stock', stockSchema)

  app.route('/api/stock-prices')
    .get(function (req, res){
    let responseObject = {}
    responseObject['stockData'] = {}
    
    //Variable to check two stocks or not
    let twoStocks = false
    
    /* Output Response*/
    let outputResponse = () => {
      return res.json(responseObject)
    }
    
    /* Find/Update Stock Document */
    let findOrUpdateStock = (stockName, documentUpdate, nextStep) => {
      Stock.findOneAndUpdate(
        {name: stockName},
        documentUpdate,
        {new:true, upsert:true}
      ).then((stockDocument, error) => {
        if(error) {
            console.log(error)
          } else if (!error && stockDocument) {
            if (twoStocks === false) {
              return nextStep(stockDocument, processOneStock)
            } else {
              return nextStep(stockDocument, processTwoStocks)
            }
          }
      })
    }
    
    /* Like Stock */
    let likeStock = (stockName, nextStep) => {
      Stock.findOne({name: stockName}).then((stockDocument, error) => {
        if(!error && stockDocument && stockDocument['ips'] && stockDocument['ips'].includes(req.ip)){
              return res.send('Error: Only 1 Like per IP Allowed')
          }else{
              let documentUpdate = {$inc: {likes: 1}, $push: {ips: req.ip}}
              nextStep(stockName, documentUpdate, getPrice)
          }
      })
    }
    
    /* Get Price */
    let getPrice = (stockDocument, nextStep) => {
      let symbol = stockDocument['name'].toUpperCase()
      let xhr = new XMLHttpRequest()
      let requestUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`
      console.log(requestUrl)
      xhr.open('GET', requestUrl, true)
      xhr.onload = () => {
          console.log("Response Text : " + xhr.responseText)
          let apiResponse = JSON.parse(xhr.responseText)
          console.log("API Response : "+ apiResponse)
          stockDocument['price'] = apiResponse['Global Quote']["05. price"]
          console.log(apiResponse['Global Quote']["05. price"])
          nextStep(stockDocument, outputResponse)
      }
      xhr.send()
    }
    
    /* Build Response for 1 Stock */
    let processOneStock = (stockDocument, nextStep) => {
      responseObject['stockData']['stock'] = stockDocument['name']
      responseObject['stockData']['price'] = stockDocument['price']
      responseObject['stockData']['likes'] = stockDocument['likes']
      nextStep()          
    }
    
    let stocks = []        
    /* Build Response for 2 Stocks */
    let processTwoStocks = (stockDocument, nextStep) => {
      let newStock = {}
      newStock['stock'] = stockDocument['name']
      newStock['price'] = stockDocument['price']
      newStock['likes'] = stockDocument['likes']
      stocks.push(newStock)
      if(stocks.length === 2){
        stocks[0]['rel_likes'] = stocks[0]['likes'] - stocks[1]['likes']
        stocks[1]['rel_likes'] = stocks[1]['likes'] - stocks[0]['likes']
        responseObject['stockData'] = stocks
        nextStep()
      }else{
        return
      }
    }

		/* Process Input*/  
    if(typeof (req.query.stock) === 'string'){
      /* One Stock */
      let stockName = req.query.stock
      let documentUpdate = {}
      if(req.query.like && req.query.like === 'true'){
        likeStock(stockName, findOrUpdateStock)
      }else{
        let documentUpdate = {}
        findOrUpdateStock(stockName, documentUpdate, getPrice)
      }
      // findOrUpdateStock(stockName, documentUpdate, getPrice)

    } else if (Array.isArray(req.query.stock)){
			twoStocks = true
      
      /* Stock 1 */
      let stockName = req.query.stock[0]
      if(req.query.like && req.query.like === 'true'){
          likeStock(stockName, findOrUpdateStock)
      }else{
          let documentUpdate = {}
          findOrUpdateStock(stockName, documentUpdate, getPrice)
      }

      /* Stock 2 */
      stockName = req.query.stock[1]
      if(req.query.like && req.query.like === 'true'){
          likeStock(stockName, findOrUpdateStock)
      }else{
          let documentUpdate = {}
          findOrUpdateStock(stockName, documentUpdate, getPrice)
      }
    }
    });
    
};
