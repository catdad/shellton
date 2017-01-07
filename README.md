# shellton

[![Linux Build][1]][2]
[![Windows Build][12]][13]
[![Test Coverage][3]][4]
[![Code Climate][5]][6]
[![Downloads][7]][8]
[![Version][9]][8]
[![Dependency Status][10]][11]

[1]: https://travis-ci.org/catdad/shellton.svg?branch=master
[2]: https://travis-ci.org/catdad/shellton

[3]: https://codeclimate.com/github/catdad/shellton/badges/coverage.svg
[4]: https://codeclimate.com/github/catdad/shellton/coverage

[5]: https://codeclimate.com/github/catdad/shellton/badges/gpa.svg
[6]: https://codeclimate.com/github/catdad/shellton

[7]: https://img.shields.io/npm/dm/shellton.svg
[8]: https://www.npmjs.com/package/shellton
[9]: https://img.shields.io/npm/v/shellton.svg

[10]: https://david-dm.org/catdad/shellton.svg
[11]: https://david-dm.org/catdad/shellton

[12]: https://ci.appveyor.com/api/projects/status/github/catdad/shellton?branch=master&svg=true
[13]: https://ci.appveyor.com/project/catdad/shellton

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
    
    var colorFunc = (chalk[name] || chalk.white).bind(chalk);
    
    var stream = through();
    stream.on('data', function(chunk) {
        writeStream.write(colorFunc(chunk));
    });
    
    return stream;
}

var input = through();
// write to the parent's output stream in green
var output = colorStream('green', process.stdout);
// write to the parent's error stream in red
var error = colorStream('red', process.stderr);

shellton({
    task: 'node',
    stdin: input,
    stdout: output,
    stderr: error
});

// use any dynamically generated javascript
input.write('console.log("output is green");');
input.write('console.error("errors are red");');
input.end();
```

## API

Shellton will use the `spawn` method from `child_process` to execute tasks by default. However, it supports `exec` as well with the same API, for when you need it. You can select which one to use, as such:

```javascript
var shellton = require('shellton');

shellton.spawn('echo spawn task');
shellton.exec('echo exec task');
```

### `shellton(options, callback)`

`options` {string | Object} : The options defining the external task to execute. This parameter is required.
- When given a string, this is the command line command being executed. You can supply a full command, as you would normally type into bash or the Windows command prompt.
- When given an object, the following properties are available:
  - `task` {string} : the command to executed.
  - `stdin` {Stream} : a stream to pipe into the command.
  - `stdout` {Stream} : a stream to where the standard output of the command will be piped.
  - `stderr` {Stream} : a stream to where the standard error of the command will be piped.
  - `cwd` {string} : the directory from where the command will be executed. The default is the current directory of the parent process.
  - `env` {Object} : the environment variables for the child process. Values here will be merged with an overwrite values in the current `process.env`.
  - `encoding` {string} : the encoding to use to the data provided to the callback. The options are `utf8` and `buffer`, with `utf8` being the default.
  
`callback` {function} : The callback to call when the child process exists. This parameter is optional. It receives the following parameters, in order:
- `error` {Error} : An error that occurred when executing the command. This generally means the command exited with a code other than 0. `error.code` specifies the exit code of the command.
- `stdout` {string|Buffer} : A string representation of the standard output of the command. If the command outputs binary, you will likely want to read directly from `stdout` in the `options` object.
- `stderr` {string|Buffer} : A string representation of the standard error of the command. If the command outputs binary, you will likely want to read directly from `stderr` in the `options` object.

[![Analytics](https://ga-beacon.appspot.com/UA-17159207-7/shellton/readme?flat)](https://github.com/igrigorik/ga-beacon)
