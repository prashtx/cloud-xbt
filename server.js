'use strict';

var request = require('request');
var httpProxy = require('http-proxy');
var proxy = new httpProxy.RoutingProxy();
var connect = require('connect');
var s3 = require('connect-s3');
var domino = require('domino');
var urllib = require('url');

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
.use(function (req, res, next) {
  if (req.url === '/search' || req.url === '/search/') {
    if (req.method !== 'POST') {
      console.log('Got invalid method: ' + req.method);
      res.statusCode = 405;
      res.end();
      return;
    }

    // Assemble the incoming request body.
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
      body += chunk;
    });
    req.on('end', function () {
      try {
        // Decode the incoming request body.
        var data = JSON.parse(body);

        // Perform the search query.
        request.get({
          url: data.url,
          headers: {
            'user-agent': req.headers['user-agent']
          }
        }, function (err, response, body) {
          if (err || response.statusCode !== 200) {
            if (err) { console.log(err.message); }
            console.log('Got search status code ' + response.statusCode);
            res.statusCode = 500;
            res.end();
            return;
          }

          // Scrape the search response
          var document = domino.createDocument(body);
          var links = document.querySelectorAll('a[href*="magnet:"]').map(function (element) {
            var href = element.href;
            return {
              href: href,
              name: urllib.parse(href, true).query.dn
            };
          });

          // Respond with search results
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.write(JSON.stringify({
            results: links
          }));
          res.end();
        });
      } catch (err) {
        res.statusCode = 400;
        res.end();
      }
    });
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
