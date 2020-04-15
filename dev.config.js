const path = require('path');
const fs = require('fs');

//Create the symlinks in ./examples/lib, prefering dependencies that live in ../ instead
//of in ./node_modules, that way you can use locally modified versions. There's probably
//a better way of doing this with webpack config but I can't be bothered right now
[['libbetter','/dist/'],['smarties','/']].forEach(([name,subfolder])=>{
	let output=`${__dirname}/examples/lib/${name}.js`;
	if(!fs.existsSync(output)){
		let target=(fs.existsSync(`${__dirname}/../${name}`) ? `/../${name}`:'/node_modules');
		target=path.resolve(`${__dirname}${target}${subfolder}${name}.js`);
		console.log("ln -s",target,output);
		fs.symlinkSync(target,output,'file');
	}
})

module.exports = {
	mode: "development"
	,entry:__dirname+"/build.js"
	,output:{
		filename:'xxx.js'
		,publicPath:__dirname+'/dist'
	}
	,devServer:{
		contentBase:__dirname+"/examples"
	}
}