var assert = require('assert');

var shell = require('./shellton.js');

var thread = shell('npm install async', function(err, stdout, stderr) {
    console.log('stdout', stdout);
    assert(stdout);
});
