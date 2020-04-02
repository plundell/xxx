//simpleSourceMap=/my_modules/xxx/xxx-bind.class.js
//simpleSourceMap2=/lib/xxx/xxx-bind.class.js
'use strict';
/*
* @component Binder
* @part-of xxx-framework
* @description This component provides two-way databinding to the DOM. 
* @author x7dude
* @license Apache-2.0
* @note: This component is required by ./xxx.proto.js, you should not need to access it directly.
* @depends libbetter
* @depends ./xxx.proto.js
* @depends smarties.Object
* @exports {function} Call this function with the dependencies to get the Binder constructor
*
* Details:
*	- <Binder> objects extend <SmartObject>, ie. 1 binder per 1 smarty. Alternatively the binder can create
*	  an empty smarty and replicate its events.
*	- Outputting to the DOM is done by listening to events on the underlying smarty
*	- Inputting from the DOM is done by listening to 'input' events on <body> (ie. you can affect how/when
*	  the binder receives input by intercepting these events before they reach <body>, which is exactly
*	  what Binder.throttle() does). 
*/
module.exports=function exportBinder(dep,proto){

	const bu=dep.BetterUtil;

	const INSTRUCTIONS="xxxBindInstructions"
	const BINDER="xxxBinder"
	const V_INST="xxxBind_valInst"
	const KEY="xxxBind_key"


	/*
	* @constructor Binder
	*
	* @param string targetClass 	A HTML class that identifies all elements connected to this binder
	* @opt object options  			Gets assigned over Binder.defaultOptions and smarties.Object.defaultOptions
	* @opt object data 				Data to set on the object right away. 
	*	^NOTE: This will assign over options.defaultValues
	* 	^NOTE: This triggers setup(), as opposed to passing options.defaultValues
	*
	* @emit 'input' (<Event>)
	* @emit Everything emitted by <SmartObject>
	*
	* @extends <SmartObject>
	*/
	function Binder(targetClass, options=null,data=null) {

		//Register this instance on Binder._instances
		proto.addInstance.call(this,targetClass);

		options=options||{};
		//Make sure we log as the binder class
		options.name=targetClass;

		
		//We allow existing <SmartObject>s to be upgraded to Binders...
		if(this===data){
			this._log.info("Turning this smarty into a Binder");
			this.__proto__=Binder.prototype;

			//Only options meant for Binder is allowed, the rest will be whatever the smarty is already using
			options=bu.subObj(options,['scrapeForData','ignoreTimeout','name'],'excludeMissing');
			Object.assign(this._private.options,options);

			//We want to change the logname, either to something passed in^ or at least to 
			//reflect that this is now a binder
			this._log.changeName(options.name);

		}else{
			//If $data was passed in seperately, set it as defaultValues
			if(data && typeof data=='object'){
				
				//If data was a smarty we listen to events on it and extend to this Binder. That
				//way we get a one-way data connection so the same smarty can be used to seed 
				//multiple Binders, and then additional values can be set on each binder
				if(data.isSmart=='SmartObject'){
					this.replicateFrom(data);
					data=data.stupify();
				}

				options.defaultValues=Object.assign({},options.defaultValues,data);
			}

			//Sets up this._log, this._private and BetterEvents inheritence. 
			dep.smarties.Object.call(this,Object.assign({},Binder._defaultOptions,options)); 
		}

		

			

		//Define the classes that identify inputs and outputs
		this._private.targetClass=targetClass  
		
	//2020-03-30: Not used anymore
		// this._private.inputClass=targetClass+"-input" 

		

		//Create this._private.actions and register the basic actions. NOTE: this.registerActionHandler is
		//added to our prototype below via proto.prototype
		proto.setupActions.call(this);


		//Listen to events emitted by self, and output data from them
		this.on('event',dataEventCallback.bind(this));


		//If data was passed in and we have nodes in the DOM: run setup right away...
		let l=this.getOutputs().length;
		if(data){
			if(l){
				this.setup();
			}else{
				this._log.trace("No nodes found in DOM, ie. not propogating default data:",this._private.options.defaultValues);
			}
		}else if(l){
			if(this._private.options.defaultValues){
				this._log.note("Nodes found in DOM, but defaultValues was passed as option instead of as arg#3"
					+", so not propogating it (or scaning for inputs)...");
			}else{
				this._log.trace("Nodes found in DOM but arg#3==false, so not scaning for inputs...");
			}
		}

		//...else setup() can be run later; Binder is ready to use either way, setup() just scrapes for
		//data and starts listening to any inputs
			
		

	} //end of constructor
	Binder.prototype=Object.create(dep.smarties.Object.prototype);
	Object.assign(Binder.prototype,proto.prototype)//add common methods
	Object.defineProperty(Binder.prototype, 'constructor', {value: Binder});


	//Static class variables
	Object.assign(Binder,proto.static);
	Object.defineProperties(Binder,{
		_baseAttr:{value:'xxx-bind'}
		,_instances:{value:dep.BetterLog.BetterMap()}
		,_defaultOptions:{value:{
			children:'complex' //used by smarties.Object only. Can be changed to 'primitive'. Changing to 'smart' will
							   //not affect how this binder works, but won't break anything

			,scrapeForData:false //If true, setup() will scrape for data which gets applied AFTER constructor(,,$data)
	
//2020-03-30: not using this for now... in near future add options that throttle events coming out of certain inputs
			,ignoreTimeout:3000 //When typing in inputs, ignore updates on that input for this many ms after
								//each keystroke... increase this number if the value bound to those inputs
								//can/tend to get changed by others during typing...

		}}
		
		//static options used by entire class. These CAN be changed at runtime. Do so BEFORE interacting with this clas
		//in any way
		,_classOptions:{value:{ 
			inputDebounce:100 //Don't update the value of inputs for this many ms after they've emitted 'input'. This prevents 
							   //loops that especially affect text inputs where you risk loosing the last typed characters if
							   //you're a fast enough typer on a slow enough system

		}}
	});
	


	/*
	* Create a Binder on top of an existing smarty
	* @param <SmartObject> smarty
	* @return $smarty
	*/
	Binder.create=function create(targetClass,options,smarty){
		if(!smarty || smarty.isSmart!='SmartObject')
			bu._log.makeTypeError("<SmartObject>",smarty).throw();

		Binder.call(smarty,targetClass,options,smarty);

		return smarty;
	}





	/*
	* This method can be called once to setup all Binders (ie. scrape for data and output default values), 
	* as well as 2-way binding.
	*
	* NOTE: If this method is NOT called Binders will only propogate future changes to their smarties
	*/
	Binder._init=bu.once(function initBinders(){
		Binder._instances.forEach(binder=>{
			if(binder.getOutputs().length){
				binder.setup();
			}
		})
		Binder._setupTwoWayBinding();
		Binder._automaticallyBind();
	})
	










	/*
	* Parse as much info about an elem as possible and store it on the elem itself. This can save crucial ms 
	* when we want a responsive interface later
	*
	* @param <HTMLElement> elem
	*
	* @return <Binder>|undefined 	The appropriate binder if one was found, else undefined
	* @no-throw
	* @call(<Binder>|any) 	For logging purposes only
	*/
	Binder._parseElem=function parseElem(elem){
		let binder=getBinder.call(this,elem);
		if(binder){
			getBindInstructions.call(this,elem); //may set empty, ie. you need to forgetElem() for this to change
			findKeyBoundToValue.call(this,elem); //may set empty, ie. you need to forgetElem() for this to change
		}
		return binder;
	}

	/*
	* Removes all 'shortcut'/'lookups' set on an elem, allowing everything to be parsed a-new. This
	* function should be called if you change instructions etc.
	*
	* @param <HTMLElement> elem
	*
	* @return void
	* @no-throw
	*/
	Binder._forgetElem=function forgetElem(elem){
		//DevNote: If you create another prop in some function, you should add it to this list
		delete elem[BINDER];
		delete elem[INSTRUCTIONS];
		delete elem[KEY];
		delete elem[V_INST];
	}


	/*
	* Get the <Binder>, if any, used on an elem
	*
	* NOTE: This function stores a reference to binder on the elem itself for future lookup speed.
	*		Use Binder._forgetElem() to remove this and other similar lookups.
	*
	* @param <HTMLElement> elem
	* @return <Binder>|undefined
	*/
	Binder._getBinder=function getBinder(elem){
		if(elem.hasOwnProperty(BINDER)){
			return elem[BINDER];
		}else{
			//Look for a binder given an elements classes, saving it if found
			let binder=ArrayFrom(event.target.classList).find(cls=>Binder._instances.has(cls));
			if(binder){
				elem[BINDER]=binder;
			}

			//Now return what may be a <Binder> or what may be undefined
			return binder;
		}
	}

	/*
	* Get binder instructions for an elem, organized by the key/prop the instruction is bound to.
	*
	* NOTE: This function stores a reference to the live parsed instructions on the elem itself for 
	* 		future lookup speed. Use Binder._forgetElem() to remove this and other similar lookups.
	*
	* @param <HTMLElement> node
	* @param @opt string key  	If given, a concated array of instructions for that key and '*' is returned
	*							 instead of the whole instructions object. Possibly an empty array
	*
	* @throw <ble TypeError> 	If $node isn't a node, bubbles from getInstructions()
	*
	* @return object 			An object where keys match keys for the underlying smart and  values 
	*							 are arrays of instructions. Possibly an empty object if no instructions 
	*							 are found. Also @see $key
	*
	* @call(<Binder>|any) 	 		Used for logging only. Please make sure in other ways that the node isn't bound to
	*								 the wrong/another binder instance
	*/
	Binder._getBindInstructions=function getBindInstructions(node, key){

		//If no live object exists on the node...
		if(!node.hasOwnProperty(INSTRUCTIONS)){
			//...parse instructions anew
			node[INSTRUCTIONS]=proto.getInstructions.call(this,node,'group'); //throws TypeError, can return empty array

			//Also delete the KEY and V_INST which may need to be re-parsed
			delete elem[KEY];
			delete elem[V_INST];
		}

		if(typeof key=='string'){
			return (node[INSTRUCTIONS][key]||[]).concat(node[INSTRUCTIONS]['*']||[]); //this also clones the array so we don't alter the orig
		}else{
			return node[INSTRUCTIONS];
		}
	}




	/*
	* Find which key, if any, in a node's instructions is bound to the nodes value. This is used to scrape
	* both inputs and outputs for data
	*
	* @param <HTMLElement> node
	*
	* @throw <ble TypeError>  		Bubbles from getBindInstructions()
	*
	* @return string|null 			A key name or null if no key could be found
	*
	* @call(<Binder>|any) 	 		Used for logging only. Please make sure in other ways that the node isn't bound to
	*								 the wrong/another binder instance
	*/
	Binder._findKeyBoundToValue=function findKeyBoundToValue(node){
		try{
			if(node.hasOwnProperty(KEY)){
				return node[KEY];
			}else{
				var key,inst,backup=null,instructions=getBindInstructions.call(this,node);
				loops:
					for(key in instructions){
						for(inst of instructions[key]){
							if(inst.fn=='value'){
								break loops;
							}else if(inst.fn=='text' || inst.fn=='html'){
								backup=inst; 
							}
						}
					}
				//------ end of loops

				//Regardless if we found anything, set this value so we don't check again until having called forgetElem()
				node[V_INST]=inst
				node[KEY]=(inst ? inst.key : undefined)

				//Now return what may be a key or what may be undefined
				return backup;
			}


		}catch(err){
			(this._log||bu._log).makeError('Failed to identify key bound to value',node,instructions,err).throw();
		}
	}

	/*
	* From an elem's instructions, find the one binding the value
	* @return object|undefined
	*/
	function findValueInstruction(instructions){
		var key,inst,backup=null,instructions=getBindInstructions.call(this,node);
		for(key in instructions){
			for(inst of instructions[key]){
									
				//If we find the 'value' action, then we return key right away, if we find either of
				//the other actions related to scrapeable data we store that key until the end of the
				//loop when we've gone through everything
				if(inst.fn=='value'){
					return inst;
				}else if(inst.fn=='text' || inst.fn=='html'){
					backup=inst; 
				}
			}
		}

		//Still running? Return a possible key used for text or html...
		return backup;
	}


	/*
	* To provide 2-way binding we listen to 'input' events on the <body>. This function sets that up and
	* should be called once AFTER the body has been loaded
	*
	* ProTip: You can check if this has been run by checking Binder._setupTwoWayBinding.hasOwnProperty('_once')
	*/
	Binder._setupTwoWayBinding=bu.once(function setupTwoWayBinding(){
		
		/*
		  Listen for all input events, but if the target hasn't been marked by ^, ignore it.
		 
		  NOTE: we update the underlying binder on EVERY SINGLE INPUT event, so for inputs which
		  		produce them in large quantities it may be wise to throttle or debounce them at
		 		the source
		*/
		document.body.addEventListener('input',binderInputEventHandler,{passive:true, capture:false})
		
		/*
		  Inputs can be focused upon, and not before being focused upon can they produce 'input' events 
		  which we may want to listen to if the input is bound to a <Binder>. So listen for 'focusin' events
		  on the <body> and use them to attempt to parse the target. If it finds a binder it sets a prop 
		  which binderInputEventHandler() will look for, ignoring the event if it's not there
		*/
		document.body.addEventListener('focusin',function parseElemOnFocus(event){parseElem(evt.target)});

		/*
		  While inputting quickly on a slow system, the 'input' events caught here^ may be slow to make it
		  all the way through the binder to .propogateToNodes() which could cause eg. the following scenario:
			- user types 'a'
			- binder starts processing 1st event {target.value:"a"}
			- user types 'b'
			- binder starts processing 2nd event {target.value:"ab"}
			- 1st event reaches .propogateToNodes() => target.value is set to "a"
			- user types 'c' 
			- binder starts processing event {target.value:"ac"}					<-- b is gone
			- 2nd event reaches .propogateToNodes() => target.value is set to "ab"  <-- b came back
			- 3nd event reaches .propogateToNodes() => target.value is set to "ac"  <-- b is gone again, forever...

		  and ultimately we've lost a 'b'. To prevent this we mark the input with attr 'inputting' while input
		  events are flowing in close succession (done by this vv func), and then we have .propogateToNodes()
		  look for this attribute and NOT run the instruction linked to the value of the input (see 
		  findKeyBoundToValue() which flags that instruction)
		*/
		bu.markInputting(Binder._classOptions.inputDebounce);


	})


	/*
	* When new elems are added or classes changed, check if said elem is/was part of a binder and
	* update it accordingly. This is done using MutationObserver on <body>
	*
	* NOTE: This will make sure <body> has loaded before running, since that could drastically
	*		slow down load time because every single added elem would trigger MutationObserver
	*
	* @return void
	*/
	Binder._automaticallyBind=bu.once(function automaticallyBind(){
		const log=proto.getLog();
		//Make sure body has loaded, else warn and run again in 1s
		if(!document.body){
			log.warn("Called too early, running again in 1s");
			setTimeout(automaticallyBind,1000);
			return;
		}

		const observer = new MutationObserver(function findNewElemsToBind(records) {
			for(let record of records){
				if(record.type=='attributes'){
					//Figure out which classes where added or which were removed (both can happen in the name record)
					let curr=record.target.className.split(' ')
						,old=record.oldValue.split(' ')
						,diff=bu.arrayDiff(curr,old,'noCheck'); //noCheck=>don't check type, we know they're arrays
					;
					
					if(diff[0].length){
						//Classes where added
						for(let cls of diff[0]){
							if(Binder._instances.has(cls)){
								//An existing elem has just been bound, update it!
								Binder._instances.get(cls).triggerUpdate(record.target);
							}
						}
					}
					if(diff[1].length){
						//classes where removed
						for(let cls of diff[1]){
							if(Binder._instances.has(cls)){
								//An existing elem is no longer bound, remove all traces of the binding so any functions
								//that only check for certain properties (and not the class, like binderInputHandler) know
								//the elem is no longer connected
								forgetElem(record.target);
							}
						}
					}

				}else if(record.addedNodes.length){ //implies type='childList'
					//^We only care about added nodes. If they're deleted they're already gone and forgotten (ie. we 
					// don't store a list of them anywhere, we fetch them every time we propogate an output)

					//While debugging we may wish to profile this
					if(log.options.lowestLvl<3){
						var start=bu.timerStart();
					}

					//Unlike with attributes^ where the target itself is the only elem of interest, and thus can only 
					//be linked to a single <Binder> at most, when elems are added they can contain children and any
					//of them can be bound to any <Binder> (ie. the same added parent can contain children bound to 
					//different <Binder>s
					let i=0;
					for(let node of record.addedNodes){
						var classes=Binder._instances.keys();
						if(bu.nodeType(node)=='element'){ //ignore 'text', 'comment' and 'attribute' nodes
							Object.keys(bu.multiQuerySelector(node,classes,'group','self','class')).forEach(
								cls=>{
									Binder._instances.get(cls).triggerUpdate(node);
									i++
								}
							)
						}
					}

					if(log.options.lowestLvl<3){
						log.debug(`It took ${bu.timerStop(start,'nano')}ns to match ${i} Binders`);
					}

				}
			}
		})
		Object.defineProperty(Binder._automaticallyBind,'observer',{value:observer});
		  //^make accessible in case we want to cancel it later for some reason


		
		observer.observe(document.body, {
		  	//Watch for the targetClass being added/removed from an elem, running parseElem()+triggerUpdate() 
		  	//or forgetElem()
		  	attributes: true
		  	,attributeFilter: ['class']
  			,attributeOldValue: true

  			//Watch for elements being added (then we can check for targetClass and run parseElem()+triggerUpdate())
  			,childList: true 		

  			//Watch the entire DOM
			,subtree: true
			
		})

	})



	/*
	* @param <Event> event 		A DOM 'input' event dispatched from ANY input (we check if it's meant for
	*							a Binder inside this handler)
	*/
	function binderInputEventHandler(event){
		//Check that the input comes from a bound target, and that we're not currently ignoring said input
		if(event.target[BINDER] && !event.target.hasAttribute('xxx-bind_ignore')){
			let self=event.target[BINDER];

			//Find the key that solves (elem.value == self[key]). Since this is an input and a user has
			//actually changed it it's highly likely that we find one... but if we don't we log and exit
			let key=findKeyBoundToValue.call(self,event.target);
			if(key==undefined){
				self._log.warn("Couldn't find a key on input bound to this Binder.",elem,self);
				return;
			}


			//Get the value depending on...
			let value = (event.target.type == 'checkbox' ? event.target.checked : event.target.value)


			//...and update the value on every change. NOTE: since we update every time it 
			//my not be a good idea to bind textboxes where users write a whole novel...
			self.set(key,value,{target:event.target,src:'input'});

			//Extra... Necessary?? Emit the input-event on the binder
			self.emit('input',event);
		}
	}



	/*
	* Event handler for smarties.Object's '_event'. 
	* @call(<Binder>)
	*/
	function dataEventCallback(event){
		//This is the reason we don't call propogateToNodes directly, which can be called with a subset of
		//all nodes related to the key (which is what forceUpdate() does)
		var nodes=getNodeArray.call(this,event.key);
		
		if(nodes.length){
			propogateToNodes.call(this,nodes,event);
		
		}else if(this._log.options.lowestLvl<3){
			self._log.last().addHandling(`Ignoring <${evt}> event for key '${key}'`);
				//^The last entry on our log will be the 'no nodes connected to this binder' created by getNodeArray()
		}
	}



















	//Define getter for inputs and outputs for ease
	Binder.prototype.getOutputs=function(){
		return Array.from(document.getElementsByClassName(this._private.targetClass))
	};
	Binder.prototype.getInputs=function(){
		return this.getOutputs.filter(bu.isInput());
	};








	/*
	* Setup this binder, ie. look through the DOM for elems to scrape and start listening to inputs 
	*
	* NOTE: This step is NOT required, the binder is already active and will propogate changes
	* NOTE2: This has no effect if called before any outputs exist
	* NOTE3: This method can be called multiple times without deterimental effect (except wasted time)
	*
	* @return this
	*/
	Binder.prototype.setup=function(){
		let outputs=this.getOutputs();
		if(!outputs.length){
			this._log.warn(`No inputs/outputs with class ${this._private.targetClass} found! Did you setup this binder too soon?`);

		}else{
			this._log.debug("Setting up these nodes:",outputs);
			outputs.forEach(parseElem.bind(this));

			//If we havn't started listening to inputs yet and this binder has some, then do it! The reason we
			//don't aways do it is because there is a little overhead involved, and if no Binders have any bound 
			//inputs then it's just a liiiiitle bit of a trim
			if(!Binder._setupTwoWayBinding.hasOwnProperty('_once') && this.getInputs().length)
				Binder._setupTwoWayBinding()

		//2020-03-30: Not necessary anymore
			//Input nodes shouldn't have the inputClass set yet. Instead we look through the
			//output nodes and flag/class any input elements we find, and at the same time 
			//attach listeners.
			// this.findNewInputs();
	
			//If opted, scrape the DOM for data BEFORE assigning any default values so we don't loose them...
			//NOTE: only nodes with 'value' fn will be scraped (not 'text' or 'html')
			if(this._private.options.scrapeForData){
				var data=this.scrape();
				if(bu.isEmpty(data))
					this._log.note("Scraped for data but none found")
				else
					this._log.info("Scraped and found data in html:",data);
			}else{
				this._log.debug("options.scrapeForData==false, ie. not scraping");
			}

			//Now that we've scraped, if default values where passed in, assign them
			if(this._private.options.defaultValues){
				this._log.debug("Propogating default values to page");
				this.forceUpdate();
			}

			//And finally apply the scraped data if any was found
			if(!bu.isEmpty(data)){
				this._log.debug("Re-applying/propogating scraped values back to page");
				this.assign(data);
			}


			this._log.trace("Setup done");
		}
		return this;
	}


	/*
	* Scrape for data on all nodes connected to this binder, then return it without assigning
	* to this instance
	*
	* @return object 	Data found on the html (regardless if it also exists in this._data)
	*/
	Binder.prototype.scrape=function(){
		this._log.trace("Scraping DOM for values...");
		var data={}, self=this;
		this.getOutputs().forEach(function scrapeDataCallback(node){
			let key=findKeyBoundToValue.call(self,node);
			if(!key)
				return;
			let value=bu.getValueFromElem(node);
			data[key]=value;
		})
		return data;
	}







//2020-03-30: Not necessary anymore!
	// /*
	// * Mark up all existing input nodes will a class so they can subsequently be easily found
	// *
	// * @return array 		All newly added nodes
	// */
	// Binder.prototype.findNewInputs=function(){

	// 	//Look among the known outputs
	// 	var outputNodes=this.getOutputs();
	// 	this._log.trace("Checking for new inputs among these outputs:",outputNodes)
	// 	var inputNodes=outputNodes.filter(elem=>this.listenToInput(elem));

	// 	if(inputNodes.length){
	// 		this._log.info(`Found ${inputNodes.length} input nodes:`,inputNodes);
	// 	}else if(!outputNodes.length){
	// 		this._log.note('No output nodes found, so no inputs can exist.');	
	// 	}else{
	// 		this._log.debug('No input nodes found amoung output nodes:',this.getOutputs());
	// 	}

	// 	return inputNodes;

	// }


	// Binder.prototype.listenToInput=function(elem){
	// 	//Dump non-inputs, else rename it for clarity
	// 	if(!bu.isInput(elem)){
	// 		return false;
	// 	}
	// 	var input=elem;

	// 	//Check that it's not disabled, and it's new,
	// 	if(input.disabled||input.classList.contains(this.inputClass)){
	// 		return false;
	// 	}
		
	// 	//...then check if their value is bound 
	// 	let key=findKeyBoundToValue.call(this,input);
	// 	if(!key){
	// 		this._log.warn("Input's value doesn't seem to be bound to any key:",input);
	// 		return false;
	// 	}

	// 	//These are the input types available: 
	// 	//		https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input
	// 	//...and there's "select"
	// 	//Different types and we monitor different events
	// 	var evt,type=input.getAttribute('type'), isText=false;
	// 	if(input.tagName=='select'){
	// 		evt='change';
	// 	}else if(input.textarea=='input'){
	// 		evt='input'; //works on mobile too
	// 		isText=true;
	// 	}else{
	// 		switch(type){
	// 			case "checkbox":
	// 			case "range":
	// 			case "radio":
	// 			case "date":
	// 			case "datetime-local":
	// 			case "color":
	// 			case "file":
	// 			case "month":
	// 			case "number":
	// 			case "password": //passwords are only really submitted to stuff, so no live updates required
	// 			case "time":
	// 			case "week":
	// 			case "image": //unsure, test it....
	// 				//I think this fires as soon as you "pick" you're thing...
	// 				evt='change';
	// 				break;

	// 			case "button":
	// 			case "submit":
	// 			case "reset":
	// 				evt='click';
	// 				break;

	// 			case "text":
	// 			case "email":
	// 			case "search":
	// 			case "tel":
	// 			case "url":
	// 				evt='input'; //works on mobile too
	// 				isText=true;
	// 				break;

	// 			case "hidden":
	// 				//Will not change
	// 				return false;
	// 		}
			
	// 	}



	// 	//For text inputs...
	// 	if(isText){
	// 		//...add a keepalive timer that we can use to remove the
	// 		//blocking-flag we're gonna set below vv
	// 		input.xxxBindKeepalive=new dep.Timer();
	// 		input.xxxBindKeepalive.on('timeout',()=>{
	// 			input.removeAttribute('xxx-bind_ignore');
	// 		})
	// 		//...when not active anymore, force an update just to make sure the text reflects
	// 		//whats actually bound to that key (on the off chance that somebody changed it 
	// 		//during the last ignoreTimeout)
	// 		input.addEventListener('onblur',()=>{
	// 			this.forceUpdate(input); //this updates input even if ignore-flag is still set
	// 		})
	// 	}


	// 	//Start listening to input, but leave a way to stop
	// 	var binderListener=()=>{

	// 		//debounce text inputs to prevent loops and the risk of loosing the last few typed letters
	// 		if(isText){
	// 			if(!input.xxxBindKeepalive.running)
	// 				input.setAttribute('xxx-bind_ignore',"");
	// 			input.xxxBindKeepalive.restart(null,this._private.options.ignoreTimeout);
	// 		}

	// 		if(type == 'checkbox'){
	// 			var value = input.checked 
	// 		} else {
	// 			var value = input.value
	// 		}

	// 		//...and update the value on every change. NOTE: since we update every time it 
	// 		//my not be a good idea to bind textboxes where users write a whole novel...
	// 		this.set(key,value);
	// 		// //Queue setting using the relay we defined in the constructor
	// 		// self._private.textBuffer.bufferEvent(key, value)
	// 	}	
	// 	input.addEventListener(evt, binderListener);
	// 	input.xxxBindUnlisten=()=>input.removeEventListener(evt,binderListener);

	// 	//Finally give the input a class so we don't check it again
	// 	input.classList.add(this._private.inputClass);


	// 	return true;
	// }
//2020-03-30: Not necessary anymore ^^




	/*
	* Get an array of nodes, either a subset of those connected to this binder or all of them
	* 
	* @param mixed x 				See switch in function body
	*
	* NOTE: This function doesn't consider the "inputting" attribute, propogateToNodes() does that for the key bound 
	*		to the nodes value only (since we may eg. want a faulty value to set a class on the <input> in which case
	*		we can't ignore the <input> altogether ) 
	*
	* @return array 
	* @call(this)		
	*/
	function getNodeArray(x){
		//Step 1: get an array of nodes
		var nodes,msg,lvl='debug';
		block:{
			let t=bu.checkType(['nodelist','array','node','string','undefined'],x);
			switch(t){
				case 'nodelist':
					x=Array.from(x);
				case 'array':
					nodes=x.filter(node=>node.classList.contains(this._private.targetClass)); 
					msg="List of nodes passed in, returning only those connected to this binder:";
					break block;
				case 'node':
					bu.multiQuerySelector(x,this._private.targetClass,'self','class');
					msg="Single node passed in, finding all its children connected to this binder:";
					break block;
			}

			nodes=Array.from(document.getElementsByClassName(this._private.targetClass)); 
			if(!nodes.length){
				//No need to log the same thing twice in a row... (which otherwise happens a lot, especially when 
				//using this.assign())
				if(this._log.options.lowestLvl<3){
					msg="No nodes connected to binder"
					let last=this._log.last();
					if(last.msg!=msg || last._age>1000){
						break block;
					}
				}
				return [];
			}else{
				lvl='trace';
				switch(t){
					case 'undefined':
						msg="Nothing passed in, getting all nodes connected to this binder:";
						break block;


					case 'string':
						//a "key filter" passed in, ie. get nodes bound to a specific key of this binder
						msg=`Getting nodes bound to key '${x}':`;
						nodes=nodes.filter(node=>{
							var instructions=getBindInstructions.call(this,node); //only throws if node isn't a node
							return instructions.hasOwnProperty(x)||instructions.hasOwnProperty('*');
						});
						break block;

					default:
						this._log.throw('BUGBUG: util.checkType() returned unexpected value:',t);
				}
			}
		}
		var logargs=[msg,nodes,this];
		
		//Step 2: remove any we're ignoring
		var ignored=bu.extractItems(nodes,function(n,i,a){
			return n.hasAttribute('xxx-bind_ignore')
		});
		if(ignored.length){
			logargs.splice(2,"Ignored flagged elems:",ignored);
		}

		//We do it this way so so production nothing gets created at all... saving some cycles...
		this._log[lvl].apply(this._log,logargs);
		

		return nodes;

	}







	/*
	* Go through an array of nodes, grouping them by key(s) they're bound to (ie. same node may appear in 
	* multiple arrays, @see @return)
	*
	* @param array|nodelist nodes 	Array of nodes
	*
	* @throw <ble TypeError> 	If $nodes is bad type
	* @throw <ble TypeError> 	If any item in $nodes isn't a node, bubbles from getBinderInstructions()
	*
	* @return object 	Keys match those on this.private.data, values are arrays of nodes bound to them 
	* @call(this) 		For logging purposes
	*/
	function splitNodesByKey(nodes){
		var obj={}; //init ret-obj
		bu.checkType(['array','nodelist'],nodes);
		var node;
		for(node of Array.from(nodes)){
			let instructions=getBindInstructions.call(this,node);
			Object.keys(instructions).forEach(key=>{
				//Add nodes to child-arrays on ret-obj for the given key
				if(obj.hasOwnProperty(key))
					obj[key].push(node)
				else
					obj[key]=[node];
			})
		}

		return obj;						
	}




	/*
	* Make sure all or a subset of nodes are up to update. This is used by .setup() to set default values. This should 
	* normally not be needed externally unless:
	* 	1. you're changing ._private.data manually so no events are emitted by the underlying <SmartObject>
	* 	2. you're not using Binder._automaticallyBind() and then add an element to this binder
	*
	* @param mixed which 	@see getNodeArray
	*
	* @return void;
	*/
	Binder.prototype.triggerUpdate=function(which){
		this._log.traceFunc(arguments);
		// console.warn("FORCED UPDATE",this)
		try{
			//First get the nodes we're going to update
			var nodes=getNodeArray.call(this,which);
			if(!nodes.length){
				this._log.warn("Trying to update of empty list of nodes, did this fire too soon? Search term:",which);
				return;
			}

			//Then split them by key (ie. keys on this._private.data)
			var keyNodesObj=splitNodesByKey.call(this,nodes);

			this._log.debug('Manually updating:',keyNodesObj);

			//Then loop through said keys, fetching the value of it and propogating that value to the nodes
			Object.entries(keyNodesObj).forEach(([key,_nodes])=>{
				propogateToNodes.call(this,_nodes,{key,value:this.get(key)});
			});
		}catch(err){
			this._log.error("Failed to update:",which,err);
		}
	}







	/*
	* Output the value of a certain key to nodes on the HTML page 
	*
	* @param array 			nodes 		An array of nodes bound to @key 	
	* @param object 		event 		Containing keys: evt, key, value, old
	*
	* @return void
	* @call(this)
	* @no_throw
	*/
	function propogateToNodes(nodes,event){
		this._log.traceFunc(arguments);
		//Get an object where keys are actions to take and values are node arrays
		var node,inst,instructions;
		for(node of nodes){
			try{
				//Get the instructions (as an array) for the key in question, and any marked with '*'
				instructions=getBindInstructions.call(this,node,event.key); //throws TypeError if not a node
				if(!instructions.length){
					throw `No instructions for '${event.key}' or '*'`
				}else{
					//Now loop through that array and apply each inst
					for(inst of instructions){
						if(inst==node[V_INST] && node.hasAttribute('inputting')){
							this._log.note("Not outputting to currently receiving input.",inst,event, node);
						}else{
							this.executeAction(node,inst,event);
						}
					}
				}
			}catch(err){
				this._log.error('Failed to get instruction from node:',{node,instructions},err)
			}
		}

		return;
	}


	/*
	* Remove binding from one or more nodes
	*
	* @param <HTMLElement>|nodelist
	*
	* @return void
	*/
	Binder.prototype.unbind=function(nodes){
		Array.from(nodes).forEach(node=>{
			node.classList.remove(this._private.targetClass);
			forgetElem(node);
		//2020-03-30: Not necessary anymore
			// node.classList.remove(this._private.inputClass);

			// if(typeof node.xxxBindUnlisten=='function'){
			// 	node.xxxBindUnlisten();
			// 	delete node.xxxBindUnlisten;
			// }

		})

		return 
	}	
				




	return Binder;
}//correct, we do NOT run this function here, see ./require_all.js
//simpleSourceMap=
//simpleSourceMap2=