/* jshint node: true */
/* global describe, it */

var chai = require('chai');
var expect = chai.expect;

var shellton = require('../shellton.js');
var platform = /^win/.test(process.platform) ? 'win' : 'nix';

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
                testSuccessResult(err, stdout, stderr, 'this is a test');
                
                done();
            });
        });

        it('executes a command with a full options object', function(done) {
            shell({ task: 'echo this is a test' }, function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, 'this is a test');
                done();
            });
        });
        
        it('takes a cwd', function(done) {
            var cwd = __dirname;
            shell({
                task: platform === 'win' ? 'dir' : 'ls',
                cwd: cwd
            }, function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, /main\.test\.js/i);
                done();
            });
        });
        it('takes an env', function(done) {
            var env = {};
            env.ABCD = 'testval';
            shell({
                task: platform === 'win' ? 'echo %ABCD%' : 'echo $ABCD',
                env: env
            }, function(err, stdout, stderr) {
                testSuccessResult(err, stdout, stderr, 'testval');
                done();
            });
        });
        it('takes an stdout stream');
        it('takes an stderr stream');

        it('does not call end on a process stream');
        it('calls end on any other stream');

        describe('calls a callback', function() {
            it('with err if the command does not exist');
            it('with an stdout parameter');
            it('with an stderr parameter');
        });    
    };
}

//describe('[Module Export]', addTests(shellton));
describe('[Spawn]', addTests(shellton.spawn));
describe('[Exec]', addTests(shellton.exec));
