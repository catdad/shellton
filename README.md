# shellton

[![Build Status](https://travis-ci.org/catdad/shellton.svg?branch=master)](https://travis-ci.org/catdad/shellton)
[![Code Climate](https://codeclimate.com/github/catdad/shellton/badges/gpa.svg)](https://codeclimate.com/github/catdad/shellton)
[![Test Coverage](https://codeclimate.com/github/catdad/shellton/badges/coverage.svg)](https://codeclimate.com/github/catdad/shellton/coverage)
[![Version][9]][8] [![Downloads][7]][8]

[7]: https://img.shields.io/npm/dm/shellton.svg
[8]: https://www.npmjs.com/package/shellton
[9]: https://img.shields.io/npm/v/shellton.svg

## Install

    npm install --save shellton
    
## Use

### Basic example

```javascript
var shellton = require('shellton');

shellton('echo all the things', function(err, stdout, stderr) {
    console.log(stdout); // all the things
});
```

### Using IO streams

You can pipe the standard output streams from the child process, as such:

```javascript
var output = fs.createWriteStream('script-output.txt');

shellton({
    task: 'node script.js',
    stdout: output
    // you can also do stderr here, if you need
    // or just pipe it to the parent process io stream
    stderr: process.stderr
}, function(err, stdout, stderr) {
    console.log('script.js has exited');
});
```

You can also provide input to the external process, as such:

```javascript
var input = fs.createReadStream('my-script.js');

shellton({
    task: 'node',
    stdin: input
}, function(err, stdout, stderr) {
    console.log('my-script.js has exited');
});
```

Use your imagination here, and you can come up with some much more useful cases.

```javascript
var shellton = require('shellton');
var through = require('through2');
var chalk = require('chalk');

function colorStream(name, writeStream) {
    writeStream = writeStream || process.stdout;
    
    var colorFunc = chalk[name] || chalk.white;
    colorFunc.bind(chalk);
    
    var stream = through();
    stream.on('data', function(chunk) {
        writeStream.write(colorFunc(chunk));
    });
    
    return stream;
}

var input = through();
// write to the parent's output stream in green
var output = colorStream('greeg', process.stdout);
// write to the parent's error stream in red
var error = colorStream('red', process.stderr);

shellton({
    task: 'node',
    stdin: input,
    stdout: output,
    stderr: error
}, function(err, stdout, stderr) {
    console.log('process exited');
});

// use any dynamically generated javascript
input.write('console.log("output is green");');
input.write('console.error("errors are red");');
input.end();
```

[![Analytics](https://ga-beacon.appspot.com/UA-17159207-7/shellton/readme?flat)](https://github.com/igrigorik/ga-beacon)
