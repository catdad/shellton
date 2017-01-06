/* jshint node: true, mocha: true, -W030 */

var path = require('path');

var chai = require('chai');
var expect = chai.expect;

var through = require('through2');
var es = require('event-stream');
var _ = require('lodash');
var isIo = require('is-io');
var root = require('rootrequire');

var platform = /^win/.test(process.platform) ? 'win' : 'nix';
var node = (platform === 'win' && isIo) ? 'iojs' : 'node';

var shellton = require('../shellton.js');

function isRegex(val) {
    return Object.prototype.toString.call(val) === '[object RegExp]';
}

function addTests(shell) {
    function testSuccessResult(err, stdout, stderr, outVal, errVal) {
        expect(err).to.not.be.ok;
        expect(stdout).to.be.a('string');
        expect(stderr).to.be.a('string');
        
        if (typeof outVal === 'string') {
            expect(stdout.trim()).to.equal(outVal);
        } else if (isRegex(outVal)) {
            expect(stdout).to.match(outVal);
        }
        
        if (typeof errVal === 'string') {
            expect(stderr.trim()).to.equal(errVal);
        } else if (isRegex(errVal)) {
            expect(stderr).to.match(errVal);
        }
    }
    
    return function() {
        it('executes a string command', function(done) {
            shell('echo this is a test', function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, 'this is a test', '');
                done();
            });
        });

        it('executes a command with a full options object', function(done) {
            shell({ task: 'echo this is a test' }, function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, 'this is a test', '');
                done();
            });
        });
        
        it('takes a cwd', function(done) {
            var cwd = __dirname;
            shell({
                task: platform === 'win' ? 'dir' : 'ls',
                cwd: cwd
            }, function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, /main\.test\.js/i, '');
                done();
            });
        });
        
        it('takes an env', function(done) {
            var env = {
                ABCD: 'testval'
            };
            shell({
                task: platform === 'win' ? 'echo %ABCD%' : 'echo $ABCD',
                env: env
            }, function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, 'testval', '');
                done();
            });
        });
        
        it('can execute NPM modules from bin when env is set', function(done) {
            shell({
                task: 'istanbul help',
                // env must be set
                env: {
                    // set both, because Windows
                    PATH: '',
                    Path: '',
                    path: ''
                }
            }, function(err, stdout, stderr) {
                expect(err).to.not.be.ok;
                expect(stdout.trim()).to.equal('');
                
                expect(stderr).to.be.a('string')
                    .and.to.have.length.above(50);
                
                done();
            });
        });
        
        describe('streams to', function() {
            function testStream(opts, stream, done) {
                var shellOut, streamOut, c = 0;

                function compare() {
                    if (c < 2) { return; }

                    expect(shellOut.toString()).to.equal(streamOut.toString());
                    done();
                }

                stream.pipe(es.wait(function(err, body) {
                    c++;
                    streamOut = body;
                    compare();
                }));

                shell(opts, function(err, stdout, stderr) {
                    c++;
                    shellOut = opts.stdout ? stdout : stderr;
                    compare();
                });    
            }
            
            it('an stdout stream', function(done) {
                var stream = through();
                var opts = {
                    task: 'echo this is a test',
                    stdout: stream
                };
                
                testStream(opts, stream, done);
            });
            
            it('an stderr stream', function(done) {
                var stream = through();
                var opts = {
                    task: 'echo this is a test 1>&2',
                    stderr: stream
                };
                
                testStream(opts, stream, done);
            });
        });

        it('does not crash on a process stream', function(done) {
            // invisible space, plus move cursor back,
            // so that the results still look pretty
            var char = '\u200B\033[1D';
            
            var command = platform === 'win' ?
                node + ' -e process.stdout.write(\'' + char + '\')' :
                node + ' -e "process.stdout.write(\'' + char + '\')"';
            
            shell({
                task: command,
                stdout: process.stdout
            }, function(err, stdout, stderr) {
                expect(stdout).to.equal(char);
                done();
            });
        });
        
        describe('on Windows', function() {
            var winit = (platform === 'win') ? it : it.skip;
            
            winit('can accept quotes commands', function(done) {
                // This is the correct command to actually issue on Windows,
                // and is the only version that actually works on Linux.
                var command = node + ' -e "process.stdin.pipe(process.stdout)"';
                
                var input = through();
                var opts = {
                    task: command,
                    stdin: input
                };
                
                shell(opts, function(err, stdout, stderr) {
                    testSuccessResult(err, stdout, stderr, 'this is a test', '');
                    done();
                });
                
                input.end('this is a test\n');
            });
            
            winit('can accept unquoted commands', function(done) {
                // This is technically not correct, but it works on Windows.
                // Since it used to work in 2.x, I am keeping this in for now.
                var command = node + ' -e process.stdin.pipe(process.stdout)';
                
                var input = through();
                var opts = {
                    task: command,
                    stdin: input
                };
                
                shell(opts, function(err, stdout, stderr) {
                    testSuccessResult(err, stdout, stderr, 'this is a test', '');
                    done();
                });
                
                input.end('this is a test\n');
            });
            
            describe('when using spawn', function() {
                var spawnit = (shell === shellton.spawn) ? winit : it.skip;
            
                spawnit('errors for quoted commands with windowsVerbatimArguments set to false', function(done) {
                    var command = node + ' -e "process.stdin.pipe(process.stdout)"';

                    var input = through();
                    var opts = {
                        task: command,
                        stdin: input,
                        windowsVerbatimArguments: false
                    };

                    shell(opts, function(err, stdout, stderr) {
                        // because Windows
                        expect(err).to.equal(null);
                        expect(stdout).to.equal(stderr).to.equal('');

                        done();
                    });

                    input.end('this is a test\n');
                });    
            });
        });
        
        describe('streams from', function() {
            
            it('an stdin stream', function(done) {
                var command = node + ' -e "process.stdin.pipe(process.stdout)"';
                
                var input = through();
                var opts = {
                    task: command,
                    stdin: input
                };
                
                shell(opts, function(err, stdout, stderr) {
                    testSuccessResult(err, stdout, stderr, 'this is a test', '');
                    done();
                });
                
                input.end('this is a test\n');
            });
        });

        describe('calls a callback', function() {
            
            it('with err if the command does not exist', function(done) {
                var notExistErrCode = platform === 'win' ? 1 : 127;
                
                shell('command-does-not-exist-435632', function(err, stdout, stderr) {
                    expect(err).to.be.an.instanceof(Error);
                    expect(err.code).to.equal(notExistErrCode);
                    done();
                });
            });
            
            it('with an stdout parameter', function(done) {
                shell('echo this is a test', function(err, stdout, stderr) {
                    expect(stdout).to.not.be.undefined;
                    testSuccessResult(err, stdout, stderr, 'this is a test', '');
                    done();
                });
            });
            
            it('with an stderr parameter', function(done) {
                shell('echo this is a test 1>&2', function(err, stdout, stderr) {
                    expect(stderr).to.not.be.undefined;
                    testSuccessResult(err, stdout, stderr, '', 'this is a test');
                    done();
                });
            });
            
            it('with nothing, when no callback is specified', function(done) {
                var out = through();
                shell({
                    task: 'echo llamas',
                    stdout: out
                });
                
                var data = [];
                
                out.on('data', function(chunk) {
                    data.push(chunk);
                });
                
                out.on('end', function() {
                    expect(Buffer.concat(data).toString().trim()).to.equal('llamas');
                    done();
                });
            });
            
            it('provides stdio streams even when there is an error', function(done) {
                var script = "process.stdout.write('1');process.stderr.write('2');process.exit(1);";

                var command = platform === 'win' ?
                    node + ' -e ' + script :
                    node + ' -e "' + script + '"';

                shell({
                    task: command
                }, function(err, stdout, stderr) {
                    expect(err).to.be.instanceof(Error);
                    
                    expect(stdout.trim()).to.equal('1');
                    expect(stderr.trim()).to.equal('2');
                    done();
                });
            });
        });
        
        describe('modifies the path', function() {
            var pathenv;
            
            before(function (done) {
                var task = platform === 'win' ? 'echo %PATH%' : 'echo $PATH';
                
                shell({
                    task: task
                }, function (err, stdout, stderr) {
                    if (err) {
                        return done(err);
                    }
                    
                    pathenv = stdout.trim();
                    
                    done();
                });
            });
            
            var regexTemplate = path.delimiter + '%s(' + path.delimiter + '|$)';
            
            it('to have more values than by default', function() {
                expect(pathenv).to.not.equal(process.env.PATH);
                expect(pathenv.length).to.be.above(process.env.PATH.length);
            });
            
            it('to include its own node_modules bin', function() {
                var binPath = path.resolve(root, 'node_modules', '.bin').replace(/\\/g, '\\\\');
                var rootRegex = new RegExp(path.delimiter + binPath + path.delimiter);
                
                expect(pathenv).to.match(rootRegex);
            });
            
            it('to include the node_modules bin of the place where it is installed', function() {
                // this one will always be last... so might as well $
                var binPath = path.resolve(root, '..', '.bin').replace(/\\/g, '\\\\');
                var rootRegex = new RegExp(path.delimiter + binPath + '$');
                
                expect(pathenv).to.match(rootRegex);
            });
        });
    };
}

//describe('[Module Export]', addTests(shellton));
describe('[Spawn]', addTests(shellton.spawn));
describe('[Exec]', addTests(shellton.exec));

describe('[env]', function() {
    
    it('returns a copy of process.env', function() {
        var newEnv = shellton.env();

        // make sure they are different objects
        expect(newEnv).not.to.equal(process.env);
        expect(newEnv).to.deep.equal(process.env);
    });
    
    it('extends process.env with the provided object', function() {
        var keys = Object.keys(process.env);
        var testKey = 'unicorn_llama';
        keys.push(testKey);
        
        var testEnv = {};
        testEnv[testKey] = 1;
        
        var newEnv = shellton.env(testEnv);
        
        expect(newEnv).to.have.all.keys(keys);
        expect(newEnv).to.have.property(testKey).and.to.equal(testEnv[testKey].toString());
    });
    
    it('extends process.env with multiple provided objects', function() {
        var keys = Object.keys(process.env);
        keys.push('unicorn');
        keys.push('fruit');
        
        var newEnv = shellton.env({
            unicorn: 'tea'
        }, {
            unicorn: 'pizza'
        }, {
            fruit: 'pineapples'
        });
        
        expect(newEnv).to.have.all.keys(keys);
        
        expect(newEnv).to.have.property('unicorn').and.to.equal('pizza');
        expect(newEnv).to.have.property('fruit').and.to.equal('pineapples');
    });
    
    it('does not modify the actual process.env', function() {
        var testKey = 'unicorn_llama';
        
        var testEnv = {};
        testEnv[testKey] = 1;
        
        var newEnv = shellton.env(testEnv);
        
        expect(process.env).to.not.have.property(testKey);
        expect(newEnv).to.have.property(testKey).and.to.equal(testEnv[testKey].toString());
    });
    
});
