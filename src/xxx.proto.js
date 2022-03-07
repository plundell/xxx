//simpleSourceMap=/my_modules/xxx/xxx.proto.js
//simpleSourceMap2=/lib/xxx/xxx.proto.js
;'use strict';
/*
* @component Prototype
* @part-of xxx-framework
* @author plundell
* @license Apache-2.0
* @description This is the main file of the frontend xxx-framework. It requires the other components and produces an
*              object containing their constructors: Binder, Navigator, Repeater.
* @depends libbetter
* @depends smarties
* @exports function   This framework exports an "exporter function" which should be called with the 
*                     dependencies to get the "real exported contents". 
*/


module.exports=function exportXXX(dep){

	//The passed in object should contain all the dependencies.
	function missingDependency(which){
		console.warn('Dependency:',dep);
		throw new Error("xxx-framework was initialized without/before a required dependency: "+which);
	}
	if(!dep.BetterUtil) missingDependency('BetterUtil');
	if(!dep.BetterLog) missingDependency('BetterLog');
	if(!dep.BetterEvents) missingDependency('BetterEvents');
	if(!dep.Smarties) missingDependency('Smarties');

	const bu = dep.BetterUtil

	const devmode=ENV=='development';

	//Is populated and returned/exported at bottom
	var _export={};


	

	//Create a static log for all static functions to use
	var xxxLog=new dep.BetterLog('xxx-framework');


	/*
	* Get an instance of BetterLog when we're not sure what context something is being called in
	* @opt object ... Pass as many alternatives as u want, first where we find a log will be used
	* @return {options:object,log:<BetterLog>}
	* @proto
	*/
	function getLogAndOptions(){
		var obj={},fallbackOptions;
		for(let x of arguments){
			if(typeof x=='object' && x){
				if(x._isBetterLog){
					obj.log=x;
				}else{
					if(x.log && x.log._isBetterLog)
						obj.log=x.log;
					else if(x._log && x._log._isBetterLog)
						obj.log=x._log
					
					if(x.options)
						obj.options=x.options;
					else if(x._private && x._private.options)
						obj.options=x._private.options;
					else if(x.constructor.name=='Object')
						fallbackOptions=x; //Use as fallback if nothing better comes along
				}

				//If we have everything, exit early
				if(obj.log && obj.options)
					return obj;
			}
		}
		obj.log=obj.log||xxxLog;
		obj.options=obj.options||fallbackOptions||{};
		return obj;
	}




	//Create the css rule we use to hide nodes
	try{
		let rule=bu.createCSSRule('.xxx-hide','display:none !important');
		xxxLog.info("Created CSS rule for class 'xxx-hide', used by the xxx framework to hide elements.",rule);
	}catch(err){
		xxxLog.error("Failed to create css rule to hide elements. Hiding elements with this framework WILL NOT WORK NOW.",err);
	}
	




	function XXX(cName, baseAttr, targetClass, options){


		Object.defineProperty(this,'isXXX',{value:cName});

		
		try{
			bu.checkType('string',targetClass);
			if(targetClass=='undefined')
				xxxLog.throwCode('EINVAL',"The string 'undefined' is not suitable as targetClass");
		}catch(err){
			xxxLog.throw(`Bad targetClass (arg#1), cannot setup xxx.${cName}.`,err)
		}
		//Check with all xxx types if an instance has already been registered with this class
		let exist=getInstance(targetClass)
		if(exist)
			xxxLog.throwCode('EEXIST',`A xxx.${exist.isXXX} with class ${targetClass} already exists.`,exist);
		

		//If still running, register it
		_export[cName]._instances.set(targetClass,this);
		Object.defineProperty(this,'targetClass',{enumerable:true,value:targetClass}); //cannot be changed

		//Any node with this targetClass is "bound" to this instance, ie. it has instructions for this instance
		Object.defineProperty(this,'nodes',{enumerable:true, value:document.getElementsByClassName(targetClass)});
		//^that is a live list, but sometimes we want to act on an array, so add an easy method
		Object.defineProperty(this.nodes,'toArray',{value:()=>Array.from(this.nodes)});
		 //NOTE: This is a live list, so it will always be up to date the the latest nodes

		//Setup ._private, defining the targetClass used to find connected nodes, and the baseAttr which is
		//the attribute name used to store instructions on a node
		Object.defineProperty(this,'_private',{value:{}});
		Object.defineProperties(this._private,{
			baseAttr:{enumerable:true, value:baseAttr}
		});
		

		//Combine passed in options with defaults
		bu.checkType(['object','undefined'],options); //throw on fail
		this._private.options=Object.assign({},_export[cName]._defaultOptions,options);



		//Setup log, using targetClass as print name as well
		Object.defineProperty(this,'log',{enumerable:false,value:new dep.BetterLog(this,
			Object.assign({'name':targetClass},options))});

		//For easy debugging, any log entry containing a node get's stored on that node
		if(devmode){
			this.log.listen(entry=>entry.extra.find(x=>bu.varType(x)=='node'&&entry.storeOnObject(x)));
		}
		

		//Inherit from dep.BetterEvents and set failed emits to log to our log
		dep.BetterEvents.call(this);

		//Warn if data is passed (legacy)
		if(arguments[4])
			this.log.makeEntry('warn',"Passing data when creating a "+cName+" is no longer supported!").changeWhere(2).exec();


	}
	XXX.prototype=Object.create(dep.BetterEvents.prototype);
	Object.defineProperty(XXX.prototype, 'constructor', {value: XXX});





	/*
	* Add new actions/capabilities to a xxx instance.
	*
	* @param string name 		Name of action. Will be converted to lower case and can then be invoked by attributes, eg: xxx-bind-nameoffunction
	* @param function func 		Will be called with: (this,{node, key, value, args:[],...any other props set on ^attr)
	*
	* @throws TypeError
	*
	* @return void
	*/
	XXX.prototype.registerActionHandler=function(name, func, silent=false){

		var a=this._private.actions;

		if(bu.checkTypes(['string',['function','string']],[name,func])[1]=='string'){
			let existingAction=func.toLowerCase();
			if(a.hasOwnProperty(existingAction)){
				//register all handlers from the existing action on our new action
				a[existingAction].forEach(f=>this.registerActionHandler(name,f)); 
			}else{
				this.log.throwCode("ENOTFOUND",`Could not find a previously registered action '${existingAction}'`);
			}
		}
		
		name=name.toLowerCase();
		
		if(a.hasOwnProperty(name)){
			a[name].push(func);
			if(!silent) this.log.debug(`Chained function to action '${name}'. Chain length is now: ${a[name].length}`);
		}else{
			a[name]=[func];
			if(!silent) this.log.debug(`Registered action '${name}'.`);
		}

		return;
	}

	/*
	* Apply an instruction to a node. 
	*
	* @param <HTMLElement> node
	* @param object inst 			The instructions stored on the node relevant to $event
	* @param object event 	 		The data emitted by the underlying smarty 
	*
	* NOTE 1: An action can consist of 1 or more callbacks
	* NOTE 2: Callbacks will be called in the order they where registered
	* NOTE 3: The same object is passed to each callback, ie. any edits will be seen by the next one
	* NOTE 4: Throwing an error will prevent further callbacks. 
	*           - throw string 'continue' to stop processing current action/instruction and move on to next
	*			- throw string 'break' to stop all actions/instructions for the node - NOTE: not caught here
	*
	*
	* @throws 'break'  Intentional. Means no further instructions should be processed for the node in question
	*
	* @return void
	*/
	XXX.prototype.executeAction=function(node, inst, event){
		try{
			if(this._private.actions.hasOwnProperty(inst.fn)){
				//The action gets called with a single object that contains the event, node 
				//and instruction, which is also de-linked from the passed in objects
				var x=Object.assign({},inst,{node},event);
					//^ NOTE: The event takes presidence, so if you have args with same name they will get lost
					//^ NOTE2: This live object gets passed to each chained func, so it can be altered...
				
				//For easier debugging we add the original event
				Object.defineProperty(x,'_event',{value:event});

				//If a pattern was given, apply it now to both new and old value
				if(x.pattern){
					x.value=applyPattern.call(this,x); //throws on bad pattern
					 //we pass along x^ so applyPattern can check for option .emptyPatternOK
					if(x.old!=undefined){
						//FutureDev: Currently Repeater considers complex items as whole units, meaning if one sub-prop 
						//           changes then all instructions are re-run, which means that some values will not have 
						//           changed, which means we'll apply the pattern twice... There's no point trying to avoid
						//			 that here since we have to examine the pattern to determine which sub-props are even 
						//			 used... REMEMBER: x.key is the index, not the named sub-props...
						//      Fix: Start allowing for nested events on repeaters
						
						x.old=applyPattern.call(this,x.key, x.old, x.pattern,node);
					}
				}

				//If testing was called for, do so now, replacing the test array with an object
				if(x.test){
					let test=x.test;
		 			x.test={result:bu.compare(x.value,test[0],test[1],test[2])};
					
					if(this.log.options.lowestLvl<3){
						x.test.logstr=(x.test.result ? '<not> ':'')+bu.logVar(x.value)+test[0]+bu.logVar(test[1])
							+(test[2]==undefined ? '' : ` ${String(test[2])}`)+'.'//will only be the case on 'between'
					}
				}

				//Check if we're calling one or more functions. 
				var funcs=this._private.actions[inst.fn], msg=`Executing fn '${inst.fn}'`, f=0;

				if(funcs.length>1)
					this.log.debug(`${msg} (${funcs.length} funcs):`,{funcs:funcs.map(f=>f.name),arg:x}).storeLastOnObject(node,devmode);
				else
					this.log.trace(`${msg}:`,x).storeLastOnObject(node,devmode);
				
				for(f;f<funcs.length;f++){
					funcs[f].call(this,x);
				}
						//^@see NOTE #5 for ending loop early
			}else{
				throw `No handler for action '${String(inst.fn)}'`;
			}
		}catch(err){
			//Allow a way for action funcs to stop further processing without logging error
			if(err==='continue'){
				let left=funcs.length-1-f;
				if(left)
					this.log.trace(`Callback threw 'continue' signal. Skipping last ${left} callbacks for action '${inst.fn}'.`,node);
			}else if(err=='break'){
				throw err; //this is meant to be caught by caller
			}else{
				this.log.error(`Failed to execute action '${inst.fn}' on node:`,node,inst,event,err);
			}
		}
	}




















/*--------- Instructions ---------*/


	/*
	* Read instructions from attributes on a node. 
	*
	* @param <HTLMElement> 	node 		A live node to get instructions from.
	* @opt <BetterLog> 		log 		Will log info or warn if instructions where/not found
	* @opt function 		cb 			Each instruction is called with this. It can alter the instruction. If it returns 'drop'
	*									 the instruction will be dropped silently, if it throws it will be dropped with an err log
	* @opt @flag 			'extract' 	The attributes will be removed from the node
	* @opt @flag 			'emptyOK' 	Will prevent warnings when no instructions where found
	* @opt @flag 			'group' 	Groups instructions by key, returning an object of arrays
	*
	* NOTE: we also look for sub-attributes of format "$baseAttr-foo" where foo will be used as the "fn" prop on returned inst
	* NOTE 2: sub-attribute values that are not full json objects will be used as the "key" prop on returned inst
	* NOTE 3: Bad instructions are stored as attributes on the node with suffix '_fail'
	* NOTE 4: @see $extract and Note#3, else $node WILL NOT BE ALTERED, ie. nothing set on it
	*
	* @throw <TypeError> 	If arg#1 or arg#2 is wrong type
	*
	* @return array[obj]|obj[arr[obj]] 		An array of instruction objects (can be empty if none exists), or @see $group
	*
	* @call(xxx instance) 	For logging + this.constructor._baseAttr
	*/
	function getInstructions(node,...optional){
		bu.checkType('node',node);
		try{
			//Initiate array that will be returned (unless 'group' is passed vv), and parse any passed in flags
			var instructions=[]
				,cb=bu.getFirstOfType(optional, 'function')
				,extract=optional.includes('extract')
				,group=optional.includes('group')
				,emptyOK=optional.includes('emptyOK') //Since individual nodes in eg. templates with multiple children
													  //may not have instructions, one may want to NOT warn
				,keyIsPattern=optional.includes('keyIsPattern')
			;

			/*
			* Adds each instruction to the overall return array
			* @param object inst
			* @return void
			* @no_throw
			*/
			var addInstruction=(inst)=>{
				//REMEMBER: ALL keys on the inst obj are passed to the action function (not just those listed here), BUT, also remember
				//that props on the 'event' object supersede them, and the prop 'node' will be set to the target node unappologetically,
				//so be careful which props you use...
				
				var propTypes={ 
					fn:'string'                       //required
					,key:['number','string','array']  //this one may be deleted below...
					,pattern:['string']               //...or this one given 'undefined', but one is required
					,args:['array','primitive','undefined'] //optional
					,test:['array','primitive','undefined'] //optional
				}
				//If globalKey exists, use it as fallback if no explicit key was specified
				inst.key=inst.key||globalKey;

				//Allow different names for certain props
				inst.args=inst.hasOwnProperty('args')?inst.args:inst.arg;
				if(keyIsPattern){
					inst.pattern=inst.pattern||inst.key;
					delete inst.key; //for clarity
					delete propTypes.key;
				}else{
					propTypes.pattern.push('undefined'); //you can still use pattern, but now it's optional...
				}

				//Now check that we have the above props, throwing on fail (ie. not including inst...)
				let t=bu.checkProps(inst,propTypes);


				//All functions are lower case, but they can be written however just to make it more legible
				inst.fn==inst.fn.toLowerCase();
				
				//Args should be an array (if nothing else an empty one)...
				if(t.args=='primitive')
					inst.args=[inst.args]
				else if(t.args=='undefined'){
					inst.args=[];
				}

				
				//If testing is desired, prepare that array. It will be used by executeAction() to check the value
				if(t.test!='undefined'){
					if(t.test=='primitive'){
						inst.test=bu.compare.splitOnOperator(inst.test) //may leave inst.test[0] == undefined, see vv
					}else if(t.test=='array'){
						if(inst.test.length==1){
							inst.test=bu.compare.splitOnOperator(inst.test[0]) //may leave inst.test[0] == undefined, see vv
						}else{
							//Make sure the array starts with an operator
							let i=inst.test.findIndex(bu.compare.isOperator)
							if(i==-1) throw new Error('No compare operator found');
							if(i!=0) inst.test.unshift(t.test.splice(i,1)); //move to front
						}
					}
					if(!inst.test[0])
						inst.test[0]='===' //compare() would do this anyway, but the logstr would miss it
				}


				//Before adding it, call the optional callback. I
				if(cb && cb(inst)=='drop'){
					return;
				}
					
				instructions.push(inst);
			}
			var badInst=(str,attr,node,err)=>{
				node.setAttribute(attr+'_fail',str);
				node.removeAttribute(attr);
				this.log.error(`Bad ${attr} instructions on node:`,node,optional,err);
			}

			//There are 3 ways/places we can find instructions:
				//1. A "global attribute" that defines the key for all other instructions. NOTE the use of '_' 
				//   instead of '-'
				var globalKey=bu.tryJsonParse(node.getAttribute(this._private.baseAttr+'_key'),'string');

				//2. As a json obj/arr on the $baseAttr (this is necessary in case we want to use the same
				//   action multiple times, like setting multiple attributes)
				var str=node.getAttribute(this._private.baseAttr);
				// console.log(this._private.baseAttr,node,str);
				if(str){
					try{
						let singleOrMultiple=JSON.parse(str);
						if(bu.checkType(['array','object'],singleOrMultiple)=='object'){
							addInstruction(singleOrMultiple)
						}else{
							//TODO 2020-02-05: Don't fail all just because one instruction is bad...
							singleOrMultiple.forEach(addInstruction)
						}

						if(extract)
							node.removeAttribute(this._private.baseAttr);	

					}catch(err){
						badInst(str,this._private.baseAttr,node,err)
					}

				}

				//3. On sub-attributes of format '$baseAttr-fn'
				var obj=bu.getSubAttributes(node, this._private.baseAttr+'-',extract);
				if(obj.id=='"{"test":"${submenu}","pattern":"navBar__${id}-submenu"}"')
				    debugger;
				for(let fn in obj){
					// console.log(this._private.baseAttr+'-'+fn,obj[fn],node);
					try{
						if(fn.includes('_fail')) //these have previously been stored by badInst() ^
							continue;

						//Try parsing the attribute value in case it's an entire inst object with key and args
						try{
							let x=obj[fn]=bu.jsonParse(obj[fn],['object','array']);
							if(!Array.isArray(x)){
								x.fn=fn;
								addInstruction(x);
								continue;
							}
							//deal with arrays below...
						}catch(err){
							switch(err.code){
								case 'EFORMAT': //It'll be a common dev error to forget a " or } while writing a json in html,
								case 'EEMPTY': //the attribute has no value at all
								case 'TypeError': //this shouldn't happen since attributes can only store strings... (and null/undef are EEMPTY)
									err.throw();
								case 'EMISMATCH': //JSON.parse produced a string or number
							    case 'EINVAL': //A string, but not a json string
							    	break; //these 2 cases are expected, we deal with them below together with the array from ^

							    default: //shouldn't be anything else
							    	this.log.throw('BUGBUG. Unexpected error from bu.jsonParse()',err);
							}
						}
						//Ok, obj[fn] is now either an array, string or number, which could either be keys or args depending on
						//if we have a global key or not...
						if(globalKey){
							addInstruction({'args':obj[fn],'fn':fn}); 
						}else{
							addInstruction({'key':obj[fn],'fn':fn});
						}
					}catch(err){
						badInst(obj[fn],this._private.baseAttr+'-'+fn,node,err)
					}
				}
				

			if(!bu.isEmpty(instructions)){
				this.log.debug(`Found ${this._private.baseAttr} instructions on node: `,instructions,node);
			}else if(!emptyOK && !node.hasAttribute(this._private.baseAttr+'_noaction')){
				//If the node is expected to have instructions, warn that it doesn't
				this.log.warn(`Node doesn't have ${this._private.baseAttr} instructions: `,node); 
			}

		}catch(e){
			this.log.error("BUGBUG",e).addHandling('arguments:',arguments);	
		}
		
		//Turn into object if opted... Do this after try/catch so we're ensured to return an object if expected
		if(group){
			instructions=groupByKey.call(this,instructions); //doesn't throw, always returns object
		}

		return instructions;
	}



	/*
	* @param array instructions 	Array of instruction objects, eg. 
	*									[{key:a, fn:show}, {key:a, fn:text},{key:b, fn:click}]
	*
	* @return object 				Keys are keys, values are nested arrays like $instructions but all with same key
	*									{a:[{key:a, fn:show}, {key:a, fn:text}],b:[{key:b, fn:click}]}
	*
	* @call(xxx)          For logging
	*/
	function groupByKey(instructions){
		try{	
			var obj={};
			instructions.forEach(inst=>{
				if(Array.isArray(inst.key)){
					inst.key.forEach(key=>bu.pushToNestedArray(obj,key,inst)); //ie. the same instruction can be added to multiple arrays
				}else{
					bu.pushToNestedArray(obj,inst.key,inst);	
				}
			})

			//Add a few func for convenience
			Object.defineProperty(obj,'keys',{value:function keys(){return Object.keys(obj)}})
			Object.defineProperty(obj,'values',{value:function values(){return instructions}})
			Object.defineProperty(obj,'length',{get:()=>instructions.length})

		}catch(e){
			this.log.error("BUGBUG",e).addHandling('arguments:',arguments);	
		}
		return obj;
	}

/*--------- end of Instructions ---------*/












/*--------------- Templates -------------*/





	/*
	* Prepare all elements in a template(s) so it can be quickly copied and values inserted into it.
	*
	* NOTE: CHANGED: this method no longer cares about data structure, so it can be run BEFORE setupData() if u wish
	* NOTE: This method can't prepare everything since we're cloning, so also see prepareClone()
	*
	* @opt string|node  _template 	If omitted this._private.options.template will be used. An id of a live node, 
	*								  an html string that can be parsed or a live node
	*
	* @throw <ble TypeError> 		$template was bad type
	* @throw <ble SyntaxError> 		$template was poorly formated htmlstring
	* @throw <ble ENOTFOUND> 		If no live element could be found
	* @throw <ble EEMPTY> 			The live element didn't contain any elements
	* @throw <ble EINVAL>    		The live element didn't contain any valid elements
	*
	* @return array 				this.templates. NOTE: alter this array at your own perill
	* 		
	* @sets this._private.options.template  	$template
	* @sets this.templates 					Array of templates (cloned nodes)
	*
	* @call(xxx)                     
	*/
	function prepareTemplates(_template){
		if(arguments.length)
			this._private.options.template=_template

		var unsetTargetOnFail=false;
		try{

			//Get a live node and make sure it's a <template> node (yes we could allow other stuff, but it's just easier
			//if we're kind of strict on what we allow)
			var templates=bu.getLiveElement(this._private.options.template); 
			if(templates.tagName!='TEMPLATE')
				this.log.throwCode("EINVAL","The template was not a <template>:");
			

			//The <template> tag contains a #DocumentFragment, which means that template.content is where the actual templates
			//reside... this is easy to forget if creating the <template> with javascript and running template.appendChild()
			//instead of template.content.appendChild(). So in order to avoid issues we simply move everything outside the 
			//DocumentFragment inside it
			if(templates.childElementCount){
				this.log.note("Child elements were found inside a <template> tag but outside the #DocumentFragment, moving"
					+" them all inside",template);
				while(templates.childElementCount){
					templates.content.appendChild(templates.firstElementChild);
				}
			}else if(!templates.content.childElementCount){
				this.log.throwCode("EEMPTY","Template didn't contain anything.");
				 //^We check again if templates is empty at bottom, but there we throw EINVAL
			}


			//Explicitly giving a target implies that the template will be used more than once => clone it
			if(this._private.options.target){
				templates=templates.cloneNode(true); //true => copy children
			}else{
				//No target => use the templates parent
				this._private.options.target=templates.parentNode; 
				this.log.debug("Set templates parentNode as target for this "+this.constructor.name+":",templates.parentNode);
				unsetTargetOnFail=true;
				 //^remember, if the template has been cloned it won't have a parentNode which means prepareTarget() will 
				 // fail unless we set a target before then
			}


			//OK, we've got templates. However the actual templates live in the DocumentFragment inside which is 
			//what we set on this...
			Object.defineProperty(this,'templates',{enumerable:true,configurable:true,value:templates.content}); 

			
			//If we have multiple templates, we have to make sure they have useif attributes, since we'll 
			//only be inserting a single template for each item in the underlying smarties.Array. So any that are missing 
			//this attr, delete
			if(this.templates.childElementCount>1){
				this.log.debug("Checking the usage rules of all templates");
				discardBadTemplates.call(this);
			}
			

			if(this.templates.childElementCount>1){	
				this.log.debug(`Multiple templates (${this.templates.childElementCount}) found:`,this.templates);
			}else{
				this.log.debug('Single template found:',this.templates.firstElementChild);
			}
			
			//Now prepare as much of the instructions as possible so we have less work to do each time we createItem()->prepareClone()
			this.log.debug("Preparing the instructions of all templates");
			prepareTemplatesInstructions.call(this)

			//If no templates existed to begin with, we threw EEMPTY ^, now if none exists that means we've removed them all...
			if(!this.templates.childElementCount)
				this.log.throwCode("EINVAL","No valid templates found.",this.templates);

			return this.templates;


		}catch(err){

			//Unset the target if we fail and it's been set, otherwise the next time we try run this it'll
			//think that the target has been explicitly specified
			if(unsetTargetOnFail)
				delete this._private.options.target;

			this.log.makeError(err,{
				options:this._private.options.template
				,live:templates
				,parsed:this.templates
			}).throw();

			//NOTE: if this.templates has been set it will remain set, as such it could be empty which will cause
			//      an error each time we try to show...
		}
	}


	/*
	* Go through a list of templates and remove bad ones
	*
	* @return void
	*
	* @call(xxx) 	Only called from prepareTemplates(). acts on this.templates
	*/
	function discardBadTemplates(){
		for(let i=this.templates.childElementCount-1;i>-1;i--){
			let temp=this.templates.children[i];

			if(!temp.hasAttribute(this.targetClass+'_usedefault')&&!temp.hasAttribute(this.targetClass+'_showonempty')){
				let attr=this.targetClass+'_useif'
				if(!temp.hasAttribute(attr)){
					this.log.warn(`Removing one of multiple templates because it's missing useif/usedefault attributes:`,temp); 
					this.templates.removeChild(temp);
					continue;
				}else{
					try{
						var rule=temp.getAttribute(attr);
						rule=bu.tryJsonParse(rule, 'array') || [rule]; 
						
						if(rule.length==1){
							//if a single value was given ^, then it was the criteria, so we add pattern and operator
							rule.unshift('$','==');
						// }else if(temp.getAttribute(rule[0]).includes('#')){  //2020-05-19: <-- that's just wrong, right?
						}else if(rule.length<3||rule.length>4){
							this.log.throwCode("EINVAL","Rules should be arrays with 3 or 4 items, this one had "+rule.length);
						}else{

							//Make sure we have a good operator
							try{bu.getCompareFunc(rule[1])}
							catch(err){this.log.throwCode("EINVAL","Bad operator in rule (second item)",err)}


							if(rule[0].includes('#')){
								this._private.indexDependentPatterns='t';  
	//TODO: keep seperate track if template-choice is '#'
								this.log.warn("Slow template chooser:",rule,temp);

							}else if(!rule[0].includes('$') && !rule[0].includes('?')){
								this.log.warn("Rule pattern doesn't contain any special characters (#,?,$) -> it's not dynamic. Is that a mistake?",rule,temp);
							}
						}

						//Make sure the operator is valid

						//now re-save the full rule
						temp.setAttribute(attr,JSON.stringify(rule));

					}catch(err){
						this.log.error(`Removing bad template:`,temp,rule,err); 
						this.templates.removeChild(temp);
						continue;
					}
				}
			}
		}
	}



    /*
	* Prepare instructions on templates so we don't have to do it each time in createItem()
	*
	* @return void
	* @call(xxx) 	   Only called from prepareTemplates(). acts on this.templates
	*/
	function prepareTemplatesInstructions(){
		var noaction=this._private.baseAttr+'_noaction'
		var i=0; //used for logging...
		for(let template of this.templates.children){ //DevNote: For some reason for...in on .children includes other props...
			let elems;
			i++;
			try{	
				//First look for any repeaters inside the template, which need to be ignored
				var repeaters=_export.Repeater.findNestedRepeaters(template);
				if(repeaters.length){
					//Optionally mark the template which repeaters need to be autocloned when the template is cloned
					if(this._private.options.cloneTemplateRepeaters)
						template.setAttribute('autoclone-repeaters',repeaters.map(target=>target._repeater.targetClass)); //creates delimited string
					
					//Get an array of all direct child elements in the repeaters so we can ignore them when
					//looking for instructions pertinent to this template
					var ignoreNested=bu.getElementsArray(repeaters).map(target=>Array.from.target.childElements).flat();;

				} 

				//Get all elements within the template except ones nested in other repeater targets
				elems=bu.getAllElements(template,ignoreNested);

				//Templates can have multiple children and not all have instructions (usually). So we send 'emptyOK' 
				//in getRepeatInstructions(), but if nobody had ANY instructions that's probably not right, so 
				//start counting...
				var total=0; 

				for(let elem of elems){
					try{
						//We need to remove ids, but for debug purposes we'd like to still be able to 
						//see them, so move them to another attribute
						if(elem.hasAttribute('id')){
							elem.setAttribute('_id',elem.getAttribute('id'));
							elem.removeAttribute('id');
						}

						//Now look for any instructions (this will set targetClass if instructions are found)
						var instructions=this.constructor.getInstructions.call(this,elem);
						if(instructions){
							//Since templates will be cloned, any live instructions will be removed, so store them as an attribute on
							// the template, then the clone can read them with JSON.parse()
							elem.setAttribute('xxxRepeat',JSON.stringify(instructions)); 
							  //^FutureDev: we can't convert them to live here and them copy them to the clone because we clone the entire
							  //template, not each child individually... just think about it

							total+=instructions.length
						}


					}catch(err){
						this.log.error(`Failed to prepare element within template #${i}.`,err,{template,elem});
					}
				};
				

				let msg=`Prepared template #${i} of ${this.templates.childElementCount},`;
				if(total || template.hasAttribute(noaction))
					this.log.debug(`${msg} it has ${total} instructions`);
				else
					this.log.warn(`${msg} but it has no instructions! (if intentional please add attribute '${noaction}'`)

			}catch(err){
				this.log.error(`BUGBUG: While processing template #${i}`,{template,elems,'this':this},err)
			}
			
		}
		return;
	}



/*---------------------- end of templates -------------------*/



















	




	/*
	* Show or hide a node if a condition evaluates to true, else do the opposite
	*
	* @param boolean 		showOnTruthy
	* @param object 		x  				An object containing the following:
	*   @prop elem 			node 			  The node to operate on
	*   @prop any 		 	value 			  The new value of the prop on the xxx instance. Used to determine hide/show, see @showIf
	* 	@opt array 			test  			  @see checkTestOrValue()
	*
	* @throws 'break'  If node is hidden
	*
	* @return void
	* @call(xxx instance) 	for logging purposes
	*/
	function setDisplay(showOnTruthy, x){
		var test=checkTestOrValue.call(this,x);
		if(test.result==showOnTruthy){
			this.log.trace(`Showing ${test.logstr}`,x.node);
			showElement(x.node);
		}else{
			this.log.trace(`Hiding ${test.logstr}`,x.node);
			hideElement(x.node);

			//In some cases, once a node is hidden there is no reason to keep processing more instructions, so throw 'break' signal. 
			if(this._private.options.breakOnHide){			
				throw 'break';
				//REMEMBER: the order of the instructions on the node matters
			}
		}
		return;
	}





	/*
	* Hide an elem in the DOM. Always works and remembers last display
	*
	* @param mixed node 	@see bu.getLiveElement
	*
	* @return void
	* @static 		 set on proto.static	
	*/
	function hideElement(node){
		node=bu.getLiveElement(node);

		//Always add our hide-class
		node.classList.add('xxx-hide');

		//Then make sure it's hiding (and save any display value set on the element which can be
		//restored by showElement later)
		bu.hideElement(node);

		return;

	}


	/*
	* Show a hidden elem in the DOM. Always works and restores previous display if available
	*
	* @param mixed node 	@see bu.getLiveElement
	*
	* @return void
	* @static 		 set on proto.static	
	*/
	function showElement(node){
		node=bu.getLiveElement(node);

		//Always remove our class
		node.classList.remove('xxx-hide');

		//Then make sure it's showing 
		bu.showElement(node); //will have no effect if already showing

	}

	/*
	* Set the id of a node. 
	*
	* NOTE: If we don't set it, we remove it (ie. we don't leave it as before)
	*
	* @param object 	x  		  An object containing the following:
	*   @prop elem       node 	   The node to operate on
	*   @prop string     value 	   The id to set
	*   @opt object      test      If present id will only be set if it passed
	*/
	function setId(x){
		if(x.value && (typeof x.value=='string') && (!x.test || x.test.result) )
			x.node.id=x.value;
		else
			x.node.removeAttribute('id');
	}



	/*
	* Add a class and remove another
	*
	* @param object 		x  		  An object containing the following:
	*   @prop elem 				node 	The node to operate on
	*   @prop any 		 		value 	New class to add
	*   @prop string|undefined 	old 	Old class to remove	

	*
	* @return void
	* @call(xxx instance) 	for logging purposes
	*/
	function followClass(x){
		//FutureDev: DO NOT try to stop propogation here! we don't know why it's being called, it may be to 
		//           fix the fact that a class has not been applied... so just let it ride!
		// if(x.old===x.value){
		// 	this.log.trace("Value didn't change, leaving class as is:",x.value,x.node);
		// 	return;
		// }


		// this.log.traceFunc(arguments);
		var bug="BUGBUG: followClass() was called with the string 'undefined', "
		var logStr='';
		if(x.old && typeof x.old=='string'){
			if(x.old=='undefined'){
				this.log.warn(bug+'not removing it.',x,x.node);
			}else{
				logStr+=`Removing class '${x.old}'`
				bu.removeClass(x.node,x.old); //can add multiple classes if .old is space delimited, also removes empty 'class' attribute
			}
		}

		if(typeof x.value=='string'){
			if(x.value=='undefined'){
				this.log.warn(bug+'not adding it.',x);
			}else{
				if(x.old==x.value)
					logStr=`Re-added class '${x.value}'`
				else
					logStr+=(logStr?' and a':'A')+`dding class '${x.value}'`
				bu.addClass(x.node,x.value);
			}

		}else if(!x.value){
			if(logStr){
				logStr+='. No new class to replace it with.'
			}else{
				this.log.note("No old or new value given, ie. classList of node has not changed.",x,x.node);
				return;
			}		
		}
		if(!logStr)
			this.log.warn("Unknown error. Class has probably NOT been updated. Called with:",x,x.node);
		else
			this.log.trace(logStr,x.node);


	}



	/*
	* Add/remove a class given a value and condition
	*
	* @param object 		x  				An object containing the following:
	*   @prop elem 			node 			  The node to operate on
	*   @prop any 		 	value 			  The new value of the prop on the xxx instance. Used to determine if we're setting or removing $cls
	* 	@prop string 		args|arg|cls 	  The class to set
	* 	@opt array 			test  			  @see checkTestOrValue()
	*
	* @return void
	* @call(xxx instance) 	for logging purposes
	*/
	function toggleClass(x){
		let cls=x.cls||x.args[0];
		bu.checkType('string',cls);
		if(cls=='undefined'){
			this.log.throw("toggleClass() was called with the string 'undefined', probably a mistake.",x);
		}

		//Determine if we're adding or removing class	
		let test=checkTestOrValue.call(this,x);
		if(test.result){
			if(x.node.classList.contains(cls)){
				this.log.trace(`Keeping existing class '${cls}' on ${test.logstr}`,x.node);
			}else{
				this.log.trace(`Adding class '${cls}' to ${test.logstr}`,x.node);
				x.node.classList.add(cls);
			}
		}else{
			if(x.node.classList.contains(cls)){
				this.log.trace(`Removing class '${cls}' from ${test.logstr}`,x.node);
				x.node.classList.remove(cls);
			}else{
				this.log.trace(`Leaving class '${cls}' off ${test.logstr}`,x.node);
			}
		}
		return;
	}

 
	/*
	* Set a prop directly on the node to the underlying value. 
	*
	* @param object 	x  				An object containing the following:
	*   @prop elem 		 node 			  The node to operate on
	*   @prop any	 	 value 			  The new value of the prop on the xxx instance. Used as the elemts prop value value,
	* 	@prop string 	 args|arg|prop 	  The prop to set
	*
	* @return void
	*
	* @call(xxx instance) 	for logging purposes
	*/
	function followProp(x){
		let prop=x.prop||x.args[0];
		bu.checkType('string',prop);
		this.log.trace(`Setting prop '${prop}' = ${x.value}`,x.node);
		x.node[prop]=x.value
		return;
	}


	/*
	* Set a prop directly on the node if the underlying value passes a test. The prop is set to $value or optional $trueValue/$falseValue
	*
	* @param object 	x  				An object containing the following:
	*   @prop elem 		 node 			  The node to operate on
	*   @prop any	 	 value 			  The new value of the prop on the xxx instance. Used to test if we're setting the prop
	* 	@prop array 	   args
	*	  @arg string 		 propName		The prop to set
	*	  @arg @opt any 	 trueValue 		Defaults to $value. The value to set if the test returns truthy
	*	  @arg @opt any 	 falseValue 	If omitted, the value of the prop will not be touched if test fails (which enables you to
	*										  have multiple actions on the same node to create a 'case' scenario)
	* 	@opt array 			test  			@see checkTestOrValue()								 
	*
	*
	* @return void
	*
	* @call(xxx instance) 	for logging purposes
	*/
	function toggleProp(x){
		let prop=x.args[0]
			,trueValue=x.args.length>1 ? x.args[1] : x.value
			,falseValue=x.args[2] //defaults to undefined
		 	,test=checkTestOrValue.call(this,x)
			,v=test.result ? trueValue : falseValue
		;
		this.log.trace(`Setting prop '${prop}' = ${v} because ${test.logstr}`,x.node);
		x.node[prop]=v; 
		return;
	}


	/*
	* Set an attribute to the underlying $value, or to $trueValue if $value passes a test
	*
	* @param object 		x  				An object containing the following:
	*   @prop elem 			 node 			  The node to operate on
	*   @prop any 		 	 value 			  The new value of the prop on the xxx instance. Used as the attribute value and to test
	*											if the attribute should be removed.
	* 	@prop array 	   args
	*	  @arg string 		attrName		The attribute to set
	*	  @opt string 		trueValue 		Defaults to $value. The value to set if the test returns truthy.
	* 	@opt array 		   test  			  @see checkTestOrValue(). A falsey test removes the 
	*								    		attribute entirely from the element.
	* @return void
	*
	* @call(xxx instance) 	for logging purposes
	*/
	function setAttribute(x){
		bu.checkTypes(['string',['string','undefined']],x.args);
		let attrName=x.args[0]
			,trueValue=x.args.length==2 ? x.args[1] : x.value
			,test=checkTestOrValue.call(this,x)
		;
		if(test.result){
			this.log.trace(`Setting attr '${attrName}'='${trueValue}' on node ${test.logstr}`,x.node);
			x.node.setAttribute(attrName,trueValue); 
		}else{
			this.log.trace(`Removing attr '${attrName}' from node ${test.logstr}`,x.node);
			x.node.removeAttribute(attrName); 
		}
		return;
	}


	/*
	* Set text at begining of node without affecting child nodes, optionaly formatting it first
	*
	* @param object x 		
	*  @prop node 
	*  @prop string|number value
	*  @opt string|function format|args[0] 	A live function or a '.' delimited string used to look on
	*										 'this' and window
	*
	* @return void
	* @call(xxx instance) 	//Used for logging and to look for $format functions
	*/
	function setText(x){

		//Format the string if requested
		var format=x.format||x.args[0];
		if(format){
			try{
				if(bu.checkType(['string','function'],format)=='function'){
					x.value=format(x.value);
				}else{
					try{
						x.value=bu.formatString(format,x.value); //will throw if operation couldn't complete, in which case we...
					}catch(err){
						//...try to eval and get a function
						let func;
						try{func=eval(format);}catch(err){getLogAndOptions(this).log.makeError('eval(): '+String(err)).throw()}
						if(typeof func=='function'){
							x.value=func(x.value);
						}else{
							getLogAndOptions(this).log.makeError("Didn't eval to function, got:",func).setCode('EINVAL').storeOnObject(x.node).throw();
						}
					}
				}
			}catch(err){
				getLogAndOptions(this).log.makeEntry('warn',"Bad 'format' instruction.",x,err)
					.addHandling("Text remains unformated.")
					.setCode('EINVAL',true).exec()
					.storeOnObject(x.node,devmode)
				;
			}
		}

		//We're printing text over there...  NOTE: This is how we controll that 'undefined' or 'null' don't get printed in UI
		if(x.value==undefined||typeof x.value=='object')
			x.value=='';

		bu.setFirstTextNode(x.node,x.value);
		return;
	}


	/*
	* Create option child elements inside a parent element
	*
	* @param object x 		
	*  @prop node 
	*  @prop array    value     Array of primitive or complex values
	*  @prop string   args[0] 	Pattern that creates the values of each option
	*  @opt string    args[1]   Pattern that creates the text of each option. If omitted the text is automatically set to value^
	*
	* @return void
	* @call(xxx instance) 	//Used for logging and to look for $format functions
	*/
	function setOptions(x){
		bu.checkType(['array','SmartArray'],x.value);

		let valuePattern=args[0], textPattern=args[1];

		var items=x.value.map((value,key)=>{
			let item={value:applyPattern.call(this,key,value,valuePattern,x.node)};
			if(textPattern)
				item.label=applyPattern.call(this,key,value,textPattern,x.node);
			return item;
		})

		bu.replaceInputOptions(x.node,items);
		return;
	}

























	/*
	* Prepare an xxx instance to use actions and register some basic actions. 
	*
	* NOTE: This method should be called from xxx constructors
	* NOTE2: If you call this method, you probably also want to set registerActionHandler() on the classes prototype
	*
	* @param @opt array includeExclude 		Array of action names. If the first item is ! the list is of those
	*										to ignore, else those to include
	*
	* @return void
	* @call(xxx instance)
	*/
	function setupActions(includeExclude){
		
		this._private.actions={}


		if(Array.isArray(includeExclude)){
			if(includeExclude[0]=='!')
				var exclude=includeExclude.slice(1);
			else
				var include=includeExclude;
		}

		var register=(name, func)=>{
			if((include && include.indexOf(name)==-1)||exclude && exclude.indexOf(name)>=-1)
				return;
			else
				this.registerActionHandler(name,func,'silent');			
		}

		register('hide',setDisplay.bind(this,false));
		register('show',setDisplay.bind(this,true));
		register('onprimitive',(x)=>{setDisplay.call(this,false,isComplex.call(this,x))}); //show element if value is a primitive
		register('oncomplex',(x)=>{setDisplay.call(this,true,isComplex.call(this,x))});    //show element if value is complex
		register('has',(x)=>{setDisplay.call(this,true,hasComplexProp.call(this,x))});     //show element if value is complex and has prop
		register('hasnot',(x)=>{setDisplay.call(this,false,hasComplexProp.call(this,x))}); //show element if value primitive or lacks prop
		register('id',setId.bind(this));
		register('class',followClass.bind(this)); //sets class to value on underlying
		register('classif',toggleClass.bind(this)); //sets value to specific arg
		register('prop',followProp.bind(this)); //set prop on HTMLElement object (ie. not visible in html and not included on clone)
		register('propif',toggleProp.bind(this)); 
		register('attr',setAttribute.bind(this));
		register('value',(x)=>{bu.setValueOnElem(x.node,x.value)});   //set value or checked attribute of node (or html if not input)
		register('html',(x)=>{x.node.innerHTML=x.value});		//set innerHTML without checking anything
		register('text',setText.bind(this)); 					//set text at begining of node without affecting child nodes
		register('showtext',(x)=>{                              //same as ^ but hide entire element on empty text
			setText(x);
			setDisplay.call(this,true,x);
		});
		register('onclick',(x)=>{
			if(typeof x.value=='function'){
				x.node.onclick=x.value;
			}else{
				let address=x.value.split('.');
				let func=address.length==1 ? this[x.value] : bu.nestedGet(this,address);
				if(func && typeof func=='function'){
					x.node.onclick=func;
				}else{
					x.node.setAttribute('onclick',x.value);
				}
			}
		});
		register('options',setOptions.bind(this));

	}

	





	/*
	* Check if a test has already been performed, or if the underlying value is empty
	*
	* @prop object 	x 	The object passed to the action function, which may or may not have the prop .test already set
	*
	* @return Object 				{result:bool, logstr:string} 	
	* @call(<xxx>)
	*/
	function checkTestOrValue(x){
		let prefix='node because'
		if(!x)
			this.log.throw("BUGBUG: called without arg");
		if(x.test && x.test.hasOwnProperty('result')){
			x.test.logstr=`${prefix} ${x.test.logstr}`
			return x.test;
		}else{
			var test={result:!bu.isEmpty(x.value,'*')} //'*'=> zero, null and false are considered empty

			if(this.log.options.lowestLvl<3){
				test.logstr=`${prefix} ${bu.logVar(x.value)} is considered ${test.result?'NOT':''} empty.`;
			}

			return test;
		}
	}


	function isComplex(x){
		x.test={result:false,logstr:'value is not complex'};
		try{
			let c=x.test.complex=this.get(x.key)
			if(c && typeof c=='object'){
				x.test.result=true;
				x.test.logstr='value is complex';
			}
		}catch(err){}
		return x;
	}


	/*
	* Check if the indicated key is a complex value that has a given prop with informational value, then
	* set the .test prop on the passed in object
	*
	* @param object x 		
	*  @prop string|number key     The key of the item on the main data object
	*  @opt  mixed         value   The prop to look for on the item
	* 
	* @return $x
	*/
	function hasComplexProp(x){
		isComplex.call(this,x);
		if(x.test.result){
			x.test.result=false;
			try{
				var address=x.value.split('.');
				if(address.length==1 && x.test.complex.hasOwnProperty(address[0]))
					var val=x.test.complex[address[0]];
				else
					val=bu.nestedGet(x.test.complex,address);

				if(val||val===false||val===0){
					x.test.result=true;
					x.test.logstr+=` and has prop ${x.value}.`
				}else{
					x.test.logstr+=`, but does not have prop ${x.value}.`
				}
			}catch(err){
				x.test.logstr=",but could not determine prop";
			}
		}
		return x;
	}















	



	/*
	* Apply a pattern to a value. This can be used to combine different pieces of information, access another value or call a getter
	*
	*
	* @param string|number key 		The Repeater index or the Binder key. Type is not checked but may be converted to primitive.
	* @param any value 				The value of the Repeater/Binder at that $key
	* @param string pattern 		A pattern like "#-${me.age}${foo}banan#hat"
	* @opt <HTMLElement> node		Used for logging and is included in args passed to any function returned by eval()
	* @opt object x					Prop .emptyPatternOK used here, everything else passed alon to possible function produced by possible eval()
	* @opt flag 'emptyPatternOK'
	*   --or--
	* @param object x               A single object with all ^
	*
	* @throw <ble TypeError> 		On $pattern and $node
	*
	* @return any
	*
	* @devnote: A pattern can resolve to undefined/null. If you don't eg. want that printed in the html you have to use an action
	*           that won't print it (as opposed to changing the rules of this method to not return it)
	*
	* @call(mixed) 		Can be anything, but log and options will be fetched from it, and eval() will run as it
	*/
	function applyPattern(key,value,pattern){
		var {log,options}=getLogAndOptions(this);

		var args;
		if(arguments.length==1){
			args=arguments[0];
			key=args.key;
			value=args.value;
			pattern=args.pattern;
		}else{
			let x;
			switch(bu.varType(arguments[3])){
				case 'node': x={node:arguments[3]};break;
				case 'object': x=arguments[3];break;
			}
			args=Object.assign({},x,{key,value,pattern});
		}
		var node=args.node;

		if(this.isXXX)
			args.xxx=this;
		
		var logstr=`Resolved pattern '${pattern}'`;

		//Start with 2 situations where any value can be returned, including undefined. NOTE: we do these first
		//because they don't distinguish between primitive and complex values/patterns
		if(pattern=='$'){
			log.traceCalled(logstr+" to the whole value:",value,node); //stored on node automatically
			return value;
		}
		if(pattern=='#'){
			log.traceCalled(logstr+"to the key:",key,node); //stored on node automatically
			return key;
		}

		//Don't check if empty patterns are OK until an empty pattern is found... to save a bit of time
		var _emptyPatternOK;
		var emptyPatternOK=()=>{
			let key='emptyPatternOK';
			if(_emptyPatternOK==undefined){
				if(args.hasOwnProperty(key)) //explicit in instructions goes first
					_emptyPatternOK=args[key]; 
				else if((node && node.hasAttribute('xxx_empty-pattern-ok'))||Array.from(arguments).includes(key)) //on node or passe in second
					_emptyPatternOK=true;
				else
					_emptyPatternOK=options[key]; //and we default to instance options
				
				//the above may have produced true,false or undef, so we check again
				if(_emptyPatternOK==undefined)
					_emptyPatternOK=false;
			}
			return _emptyPatternOK;
		}


		//Then we move on to substitution. Let's say we have
		//	key=7 		value={foo:"bar",me:{age:4}}		pattern="#-${me.age}${faa||foo}banan#hat"
		//First we split the pattern into components, 
		//	["#", "-", "${me.age}", "${foo||bar}", "banan", "#", "hat"]
		//then we substitute each item, 
		//	[7, "-", 4, "bar", "banan", 7, "hat"]
		//and finally we combine them into a string
		//	"7-4barbanan7hat"
		if(typeof pattern!='string')
			log.throwType('string',pattern);
		var parts=pattern.split(/(\$\{[^}]+\}|#|\$)/) //the surrounding capture group means the split values are kept
			.filter(part=>part) //remove any empty parts that may have formed
			.map(part=>{
				if(part=='$')
					return value; //WARN: this may include unexpected stuff into the resulting string, but ProTip: a custom 
								  //	  toString() method can sort that...
				if(part=='#')
					return key;

				//If it's a complex ref
				let m=part.match(/\$\{([^}]+)\}/);
				if(m){
					if(value===undefined||value===null){
						return value;
					}else if(typeof value!='object'){
						if(!emptyPatternOK())
							log.warn(`Pattern contains complex part ('${part}'), but value is primitive.`,args)
								.storeLastOnObject(node,devmode);
						
						return undefined;
					}else{
						//The pattern can contain multiple alternatives, delimited by '||'. The first truthy one is returned
						for(let alt of m[1].split('||')){
							let val=(alt.includes('.') ? bu.nestedGet(value,alt.split('.')) : value[alt]);
							if(val||val!=0)
								return val;
						}
					}
					return undefined
				}

				//If we're still running then this is not a dynamic part (eg. the string 'banan' from ^), just return it
				return part;
			})
		;

		//If we're left with a single part we use it as it, else we combine all parts into a string
		if(parts.length>1){
			var whole=parts.join('');
			if(whole.includes('[object '))
				log.warn("Parts of the pattern resolved to objects without good .toString() methods resulting in:",whole,parts,args)
					.storeLastOnObject(node,devmode);
		}else{
			whole=parts[0];
		}


		//If we now have a string we may either want to eval it or turn it into a primitive
		if(typeof whole=='string'){
			if(whole.startsWith('?')){
				args.eval=whole.substring(1);
				try{
					whole=eval(args.eval);
				}catch(err){
					log.makeEntry('warn',"Failed to eval:",args.eval,args,err).addHandling('Setting value to empty string.').exec()
						.storeOnObject(node,devmode);
					whole='';
				}
				//If that produced a function we call it with the args specified at the top
				if(typeof whole=='function')
					whole=whole(args);
			}else{
				whole=bu.stringToPrimitive(whole)
			}
		}


		//Finally we want to log something. Since this method is also used to test which template should be used by
		//Repeater we can't well warn every time it produces an empty string since that will be most of the time, so
		//we've included a hidden 4th argument...
		if((whole===''||whole==undefined) && !emptyPatternOK()){
			log.makeEntry('warn',`${logstr} to ${typeof whole=='string'?'empty string':'undefined'}.`,args).calledFrom().exec()
				.storeOnObject(node,devmode);
		}else{
			log.traceCalled(logstr+' =>',whole,args).storeLastOnObject(node,devmode);
		}

		return whole;
	}


























/*---- Repeater and Binder prototype ----*/

	/*
	* Used by Binder and Repeater to prepare for data connections
	* @call(xxx)
	*/
	function prepareForData(dataConstructor,data=undefined){

		//Used by connectData() to verify or create underlying data source
		this._private.dataConstructor=dataConstructor;

		/*
		* Create unique version of listener callback since we can share the underlying SmartArray but
		* may wish to manipulate this Repeaters listening status seperately
		*/
		this._private.dataEventCallback=_export[this.isXXX].dataEventCallback.bind(this);


		//Create public getter/setter
		Object.defineProperty(this,'data',{enumerable:true
			,get:()=>this.hasData()?this._private.data:this.log.throwCode("ESEQ",`No data has been connected to this ${this.constructor.name} yet.`) //throw until data gets set
			,set:data=>this.connectData(data)
		})

	}

	



	var BinderRepeaterPrototype={};


	/*
	* Check if this.data has been set without throwing a ESEQ
	*
	* @return bool 			
	*
	* @call(xxx) 	Set on prototype for Repeater and Binder
	*/
	BinderRepeaterPrototype.hasData=function hasData(){
		return this._private.data ? true : false;
	}




	/*
	* Used by Binder and Repeater to create a new (empty) data smarty. 
	*
	* NOTE: Binders will create objects while repeaters will create arrays
	*
	* @return this
	*/
	BinderRepeaterPrototype.createData=function(){
		if(this.hasData())
			this.log.throwCode("EEXISTS", `This ${this.isXXX.toLowerCase()} already has a data source.`);

		//If a regular array is passed, create a new smarty with whatever options happen to be set on this Repeater...
		let options=this._private.dataConstructor.getRelevantOptions(this._private.options);
		let smarty=new this._private.dataConstructor(options);

		this.connectData(smarty);

		this.log.debug(`Created empty ${this._private.dataConstructor.name} data source on this ${this.isXXX.toLowerCase()}.`,smarty);
		
		return this;

	}


	/*
	* Set data for this repeater to use (ie. an underlying <SmartArray>)
	*
	* NOTE: This will NOT replace data inside an existing underlying <SmartArray> (for that use this.replace()),
	*       it will instead replace any existing <SmartArray> altogether
	*
	* @param <Smarty>         object=>binder, array=>repeater
	*
	* @throws <ble TypeError>
	* @throws <ble ESEQ> 		If 
	*
	* @return this
	*/
	BinderRepeaterPrototype.connectData=function connectData(smarty){

		//Make sure we have the right type of data
		bu.checkType(this._private.dataConstructor,smarty);
		try{
			if(this.hasData()){
				if(this.isShowing()){
					this.log.throwCode("ESEQ", "Cannot connect new data source while old one is showing. Call .hide() first.");
				}else if(this.data==smarty){
					this.log.debug("Already using this smarty as data source.",smarty);
					return this;
				}else{
					this.log.debug("Changing data source.",{from:this.data, to:smarty});
				}
			}else{
				this.log.debug("Connecting new data source.",smarty);
			}

			//Set it! (If it's the first time it'll remove the getter defined in the constructor, ie. ESEQ will no longer be thrown...)
			this._private.data=smarty;

			return this;

		}catch(err){
			this.log.throwCode("BUGBUG",'Unexpected error while trying to set smart data.',err);
		}
	}






	/*
	* Disconnect an underlying smarty from this XXX instance. 
	*
	* NOTE: if nothing is connected then nothing will happen
	*
	* @return this;
	*/
	BinderRepeaterPrototype.disconnectData=function disconnectData(){
		if(this.hasData()){
			if(this.isShowing()){
				this.log.throwCode("ESEQ", "Cannot disconnect data source while it's showing, call .hide() first.");
			}
			this.log.debug("Disconnecting data",this.data);
			delete this._private.data;
		}else{
			this.log.trace("No data connected, nothing to disconnect.");
		}
		
		return this;
	}



	/*
	* Set data on this XXX, either by creating a new smarty or by replacing the data on an existing smarty. If no
	* data is passed in this function just makes sure (creating if not) that a smarty is connected
	*
	* @param mixed data  
	*
	* @throw mixed        If we don't have this.data set after this operation
	*           
	* @return void
	* @call(xxx) 		Called from Binder/Repeater.show()
	*/
	function createReplaceOrVerifyDataExists(data){
		let cName='<'+this._private.dataConstructor.name+'>',xName=this.isXXX.toLowerCase();
		if(data){ //got data...
			if(bu.checkType(this._private.dataConstructor,data,true)){
				if(this.hasData()){//...+ we already have data
					if(data===this.data){
						this.log.trace(`This same ${cName} is already being used...`);
					}else{
						this.log.throwCode("EEXISTS",`Another ${cName} is already being used as data source on this ${sName}.`
							,{existing:this.data,new:data})
					}
				}else{
					this.connectData(data); //logs
				}
			}else if(this.hasData()){
				this.log.debug(`Replacing data on existing ${cName} with:`,data);
				this.data.replace(data);  //TODO 2020-10-06: Should we worry about the same as 'silent' fixes vv??
			}else{
				this.createData();
				this.log.debug(`Populating new data source with:`,data)
				this.data.assign(data,'noEmit'); //noEmit, since we don't want async events to start coming in after
											     //we've manually propogated data to the DOM
			}

		}else if(!this.hasData()){
			this.createData(); //set empty data, logs
		}
		return;
	}



	/*
	* Start listening for changes on our data source and pass them to our handler
	* @return void
	* @call(xxx) 		Called from Binder/Repeater.show()
	*/
	function listenToData(){
		//Start listening for changes on our data source and pass them to our handler
			this.data.on('event',this._private.dataEventCallback);
				//NOTE: ^this listener is what determines if the repeater has been setup or not.
			this.data.on('update',this._private.dataEventCallback); 
			  //NOTE: ^this event is not natively emitted by the smarty, but it can be manually emitted to re-draw an item

	//TODO 2020-07-30: Events handled by children should not be handled again... maybe add a prop on the event that it's been handled

		//Extend the data source's log to ours
		this._private.extendedLog=this.log.extend(this.data._log);

	}

	/*
	* Start listening for changes on our data source and pass them to our handler
	* @return void
	* @call(xxx) 		Called from Binder/Repeater.hide()
	*/
	function stopListeningToData(){
		//Stop propogating changes to DOM
		this.data.removeListener(this._private.dataEventCallback,'event');
		this.data.removeListener(this._private.dataEventCallback,'update');

		//Stop listening to the smarties log
		this.data._log.ignore(this._private.extendedLog);
		this._private.extendedLog=undefined
	}

	/*
	* Check if Repeater is setup and showing data
	*
	* @return bool 			
	*
	* @call(xxx) 	Set on prototype for Repeater and Binder
	*/
	BinderRepeaterPrototype.isShowing=function isShowing(){
		if(!this.hasData()) //if we don't check we could get a ESEQ vv
			return false;

		//Check if the listener set by .show() is present on the data
		return this.data.hasListener('event',this._private.dataEventCallback)
	}









/*---- end of Repeater and Binder prototype ----*/

























	
	/*
	* Get a live instance
	*
	* @param string targetClass
	*
	* @return <xxx>|undefined 	
	*/
	function getInstance(targetClass){
		for(let cls in _export){
			if(_export[cls].hasOwnProperty('_instances') && _export[cls]._instances.has(targetClass)){
				return _export[cls]._instances.get(targetClass);
			}
		}
		return;
	}

	/*
	* Get a unique targetClass string that can be used to create a new instance
	*
	* @bound string who 		The class name
	*
	* @param any suggestion 		
	*
	* @return string
	*/
	function getUniqueTargetClass(who,suggestion){
		if(!suggestion)
			suggestion=who;

		var base=suggestion
			,targetClass=suggestion
			,i=1
		;
		while(getInstance(targetClass)){
			targetClass=base+'_'+String(++i);
		}
		return targetClass;
	}

	








	var proto={
		log:xxxLog
		,XXX
		,static:{
			hideElement
			,showElement
			,setText
			,applyPattern
			,getInstance
		}
		,prepareTemplates
		,BinderRepeaterPrototype //methods set on this object gets set on Binder and Repeater prototype
		,getInstructions
		,setupActions
		,getLogAndOptions
		,prepareForData
		,createReplaceOrVerifyDataExists
		,listenToData
		,stopListeningToData
	};




	//Now require the pieces of the framework and export them
	_export.Binder=proto.Binder=require('./xxx-bind.class.js')(dep,proto);
	_export.Navigator=require('./xxx-nav.class.js')(dep,proto);
	_export.Repeater=require('./xxx-repeat.class.js')(dep,proto);


	//Set methods on each constructor who's first argument is bound to the name of the class
	for(let cls in _export){
		_export[cls].getUniqueTargetClass=getUniqueTargetClass.bind(null,cls);
	}


	return _export;
}
	
//simpleSourceMap=
//simpleSourceMap2=