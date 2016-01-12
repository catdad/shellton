# shellton

[![Build Status](https://travis-ci.org/catdad/shellton.svg?branch=master)](https://travis-ci.org/catdad/shellton)

# Install

    npm install --save shellton
    
# Use

    var shellton = require('shellton');
    
    shellton('echo all the things', function(err, stdout, stderr) {
        console.log(stdout); // all the things
    });
