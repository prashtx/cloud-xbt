'use strict';

var http = require('http');
var request = require('request');
var httpProxy = require('http-proxy');
var proxy = new httpProxy.RoutingProxy();

var rpcBase = process.env.TRANSMISSION_BASE;
var s3Bucket = process.env.S3_BUCKET;
var s3BasePath = process.env.S3_BASE_PATH;

var rpcBaseParts = rpcBase.split(':');
console.log(rpcBaseParts);
var port = process.env.PORT || 3000;


var reRpcPrefix = /^\/transmission\/rpc/;
var reApp = /^\/kettu(.*)/;
var optionsRpc = {
  host: rpcBaseParts[0],
  port: rpcBaseParts[1]
};
var s3BaseUrl = 'http://' + s3Bucket +
'.s3-website-us-east-1.amazonaws.com/' + s3BasePath;

http.createServer(function (req, res) {
  if (reRpcPrefix.test(req.url)) {
    proxy.proxyRequest(req, res, optionsRpc);
    return;
  }

  var result = reApp.exec(req.url);
  if (result !== null) {
    var newUrl = s3BaseUrl + result[1];
    request.get({
      url: newUrl,
      followRedirect: false,
      encoding: null
    }, function (err, response, body) {
      if (response.statusCode === 302) {
        console.log('Got 302 Found from S3');
        res.statusCode = 302;
        // S3 will return 302 Found if it found an index.html and wants to
        // redirect us to a directory-looking URL
        res.setHeader('Location', req.url + '/');
        res.end();
      } else {
        res.setHeader('content-type', response.headers['content-type']);
        res.setHeader('etag', response.headers['etag']);
        res.write(body);
        res.end();
      }
    });
  } else {
    console.log('No match. Request received for: ' + req.url);
    res.statusCode = 404;
    res.end();
  }
}).listen(port, function () {
  console.log('Listening on port ' + port);
  console.log('S3 bucket: ' + s3Bucket);
  console.log('S3 base path: ' + s3BasePath);
  console.log('S3 base URL: ' + s3BaseUrl);
  console.log('RPC host: ' + optionsRpc.host);
  console.log('RPC port: ' + optionsRpc.port);
});
