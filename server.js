'use strict';

var request = require('request');
var httpProxy = require('http-proxy');
var proxy = new httpProxy.RoutingProxy();
var connect = require('connect');
var s3 = require('connect-s3');

var rpcBase = process.env.TRANSMISSION_BASE;
var staticPrefix = process.env.STATIC_PREFIX;

var rpcBaseParts = rpcBase.split(':');
console.log(rpcBaseParts);
var port = process.env.PORT || 3000;


var reRpcPrefix = /^\/transmission\/rpc/;
var optionsRpc = {
  host: rpcBaseParts[0],
  port: rpcBaseParts[1]
};

connect()
.use(connect.compress())
.use(s3({
  pathPrefix: '/kettu',
  remotePrefix: staticPrefix
}))
.use(function (req, res, next) {
  if (reRpcPrefix.test(req.url)) {
    proxy.proxyRequest(req, res, optionsRpc);
  } else {
    next();
  }
})
.use(function (req, res) {
  if (req.url === '/') {
    res.statusCode = 302;
    res.setHeader('Location', '/kettu/');
    res.end();
  } else {
    console.log('No match. Request received for: ' + req.url);
    res.statusCode = 404;
    res.end();
  }
})
.listen(port, function () {
  console.log('Listening on port ' + port);
  console.log('Static prefix: ' + staticPrefix);
  console.log('RPC host: ' + optionsRpc.host);
  console.log('RPC port: ' + optionsRpc.port);
});
