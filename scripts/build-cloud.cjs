const esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['cloud-bridge-src.js'],bundle:true,platform:'browser',format:'iife',minify:true,outfile:'www/cloud-bridge.js'});
