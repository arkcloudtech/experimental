const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const sha256 = require('sha256');

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const request = require('request');
const cheerio = require('cheerio');
const mongoose = require('fs');
const errTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Puffy Logo Navigation Error</title>
</head>
<body>
    <h1> We had some problems finding what you were looking for, Sorry :-( </h1>
    <p-custom />
</body>
</html>
`;

//Runs every time a request is recieved
function logger(req, res, next) {
    console.log('Request from: ' + req.ip + ' For: ' + req.path); //Log the request to the console
    next(); //Run the next handler (IMPORTANT, otherwise your page won't be served)
}

async function dynamicRouter(req, res, next) {
    console.log('puffy-router:' + req.ip + ' For: ' + req.originalUrl);
    let dRouter = 'd-route';
    if(req.originalUrl.indexOf(dRouter) > -1){
        // already route corrected >> 
        let partRoute = req.originalUrl.split(dRouter + "=")[1];

        // decode url param held in d-route
        let decodedRoute =  decodeURIComponent(partRoute);
        // go grab resource manually >>
        try {
          let resp = await mirrorResp(decodedRoute);
          let reSnapName = sha256(decodedRoute);
          let reSnapPath = path.join(__dirname, 'reSnaps/');
          let rsp = `${reSnapPath}/${reSnapName}.rsnap`;

          // check if represented already
          let fs = require('fs');
          let rpz = fs.existsSync(rsp);
          let fData = "";
          if(!rpz){
            // << save it to disk after hashing it
            fs.writeFileSync(rsp, resp.body , { mode: 0o755 });
            fData = resp.body;
          } else {
            fData = fs.readFileSync(rsp);
          }

          // now return fData (but in what format???)
          res.send(fData);

        } catch(ex) {
          console.log(ex);
        }
    } else {
      // if doc is an html like document then process it
      let doc = await dynamicPuffy(req, res);

      // prepare $elector
      var $ = require('cheerio').load(doc);
  
      // intercept all links (anything with src or href attributes)
      var sources = $('[src]').each((i, ele)=>{
          ele.attribs["src"] = `http://localhost:${port}?${dRouter}=${encodeURIComponent(ele.attribs["src"])}`;
      });
      var hrefs = $('[href]').each((i, ele)=>{
          ele.attribs["href"] = `http://localhost:${port}?${dRouter}=${encodeURIComponent(ele.attribs["href"])}`;
      });
  
      res.send($.html());
    }
}

//Configure the settings of the app
app.use(logger); //Tells the app to send all requests through the 'logger' function
app.use(dynamicRouter); // cusdtom channeling
app.use(express.static('public'));
app.use(express.static('files'));
app.use('/static', express.static(path.join(__dirname, 'public')));

app.get('/', async function(req, res, next){
    try {
        let doc = await dynamicPuffy(req, res);
        res.write(doc);
    } catch(err){
        res.write(err);
    }
});

//Example of a dynamic post handler
app.post('/p-inputs/', function(req, res) {
    res.setHeader('Content-Type', 'text/html');
    res.write('Posted data to server: '); //Send data to the client
    res.end(req.body); //Send the post data to the client and end the request
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

// channeling code

async function doRequest(url) {
  return new Promise(function (resolve, reject) {
    request(url, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
};

async function mirrorResp(url) {
  return new Promise(function (resolve, reject) {
    request(url, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve({ body: body, resp: res });
      } else {
        reject(error);
      }
    });
  });
};

async function dynamicPuffy(_req,_res){
    let URL = "https://www.cannabiscope.com/app/wheel/arkcloudtech/";
    let finalDoc = await doRequest(URL);
    return finalDoc;
};