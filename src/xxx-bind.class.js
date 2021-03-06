//simpleSourceMap=/my_modules/xxx/xxx-bind.class.js
//simpleSourceMap2=/lib/xxx/xxx-bind.class.js
'use strict';
/*
* @component Binder
* @part-of xxx-framework
* @description This component provides two-way databinding to the DOM. 
* @author plundell
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

		
		//Are we upgrading an existing <SmartObject>... (see upgradeSmarty())
		if(this===data){
			this._log.info("Turning this smarty into a Binder");
			this.__proto__=Binder.prototype;

			//Only options meant for Binder is allowed, the rest will be whatever the smarty is already using
			options=bu.subObj(options,['scrapeForData','ignoreTimeout','name'],'excludeMissing');
			Object.assign(this._private.options,options);

			//We want to change the logname, either to something passed in^ or at least to 
			//reflect that this is now a binder
			this._log.changeName(options.name);

			//Any existing data will be propogated to the DOM after some more setup below.


		//...or are we creating a new <Binder> from scratch?
		}else{
			//If $data was passed in seperately, set it as defaultValues
			if(data && typeof data=='object'){
				
				//If data was a smarty we listen to events on it and extend to this Binder. That
				//way we get a one-way data connection so the same smarty can be used to seed 
				//multiple Binders, and then additional values can be set on each binder without 
				//affecting the shared smarty
				if(data.isSmart=='SmartObject'){
					this.replicateFrom(data);
					data=data.stupify();
				}

				//Any seperate data passed in is combined with options.defaultValues because 
				//they're both together the default values of this Binder
				options.defaultValues=Object.assign({},options.defaultValues,data);
			}

			//Extend the <SmartObject> class. If any data/defaultValues where passed in then they'll 
			//emit events as the smarty calls .reset() as part of it's setup. The problem is we're 
			//not listening for that yet, so we we manually propogate below.
			dep.Smarties.Object.call(this,Object.assign({},Binder._defaultOptions,options)); 
				//^Sets up this._log, this._private and BetterEvents inheritence. 
		}
		//NOTE: in both cases above (upgrade/new) we have yet to propogate data to the DOM

		//Define the classes that identify inputs and outputs
		this._private.targetClass=targetClass  
		
	
		//Create this._private.actions and register the basic actions. NOTE: this.registerActionHandler is
		//added to our prototype below via proto.prototype
		proto.setupActions.call(this);


		//Listen to events emitted by self, and output data from them
		this.on('event',dataEventCallback.bind(this));


		//If there are already outputs and we have initial data, propogate it now! 
		if(this.getOutputs().length && this.length){
			this.setup();
		}
		//ProTip: this^ will overwrite any data already in the DOM that we may wish to scrape (in which 
		//case you should create an empty Binder, run .scrape(), then run .fillOut())


	} //end of constructor
	Binder.prototype=Object.create(dep.Smarties.Object.prototype);
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

	
//2020-03-30: not using this for now... in near future add options that throttle events coming out of certain inputs
			,ignoreTimeout:3000 //When typing in inputs, ignore updates on that input for this many ms after
								//each keystroke... increase this number if the value bound to those inputs
								//can/tend to get changed by others during typing...

		}}
		
		//static options used by entire class. These CAN be changed at runtime. Do so BEFORE interacting with this clas
		//in any way
		,_staticOptions:{value:{ 
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
	Binder.upgradeSmarty=function upgradeSmarty(targetClass,options,smarty){
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
		//Any binders that were created before there where outputs, propogate them now...
		Binder._instances.forEach(binder=>{
			if(!binder._private.isSetup){
				binder.setup();
			}
		})

		Binder._setupTwoWayBinding();
		
		Binder._automaticallyBind();
	})
	

	//Since ^ can optionally be called but doesn't have to be, we check a few seconds after this file has
	//loaded and warn if it hasn't been, just so the dev knows he may be forgetting something
	setTimeout(function BinderInitCheck(){
		if(!Binder._setupTwoWayBinding._once){
			bu._log.note("You have not run Binder._setupTwoWayBinding() which means binding is only one way, ie. any changes"
				+" made by the user to DOM inputs won't affect the Binder (and will be overwritten if the Binder later changes");
		}

		if(!Binder._automaticallyBind._once){
			bu._log.note("You have not run Binder._automaticallyBind() which means current data won't be automatically"
				+" propogated to new nodes, instead you have to call .triggerUpdate(node) manually, or wait for the data to change")
		}
	},3000)







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
	Binder._parseElem=parseElem;
	function parseElem(elem){
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
	Binder._forgetElem=forgetElem;
	function forgetElem(elem){
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
	Binder._getBinder=getBinder;
	function getBinder(elem){
		if(!elem.hasOwnProperty(BINDER)){
			//Look for a binder given an elements classes, saving it if found
			let cls=Array.from(elem.classList).find(cls=>Binder._instances.has(cls));
			if(cls){
				elem[BINDER]=Binder._instances.get(cls);
			}
		}
		//Now return what may be a <Binder> or what may be undefined
		return elem[BINDER];
	}

	/*
	* Get binder instructions for an elem, organized by the key/prop the instruction is bound to.
	*
	* NOTE: This function stores a reference to the live parsed instructions on the elem itself for 
	* 		future lookup speed. Use Binder._forgetElem() to remove this and other similar lookups.
	*
	* @param <HTMLElement> elem
	* @param @opt string key  	If given, a concated array of instructions for that key and '*' is returned
	*							 instead of the whole instructions object. Possibly an empty array
	*
	* @throw <ble TypeError> 	If $elem isn't an element, bubbles from getInstructions()
	*
	* @return object 			An object where keys match keys for the underlying smart and  values 
	*							 are arrays of instructions. Possibly an empty object if no instructions 
	*							 are found. Also @see $key
	*
	* @call(<Binder>|any) 	 		Used for logging only. Please make sure in other ways that the elem isn't bound to
	*								 the wrong/another binder instance
	*/
	Binder._getBindInstructions=getBindInstructions;
	function getBindInstructions(elem, key){

		//If no live object exists on the elem...
		if(!elem.hasOwnProperty(INSTRUCTIONS)){
			//...parse instructions anew
			elem[INSTRUCTIONS]=proto.getInstructions.call(this,elem,'group'); //throws TypeError, can return empty array

			//Also delete the KEY and V_INST which may need to be re-parsed
			delete elem[KEY];
			delete elem[V_INST];
		}

		if(typeof key=='string'){
			return (elem[INSTRUCTIONS][key]||[]).concat(elem[INSTRUCTIONS]['*']||[]); //this also clones the array so we don't alter the orig
		}else{
			return elem[INSTRUCTIONS];
		}
	}




	/*
	* Find which key, if any, in a elem's instructions is bound to the nodes value. This is used to scrape
	* both inputs and outputs for data
	*
	* @param <HTMLElement> elem
	*
	* @throw <ble TypeError>  		Bubbles from getBindInstructions()
	*
	* @return string|null 			A key name or null if no key could be found
	*
	* @call(<Binder>|any) 	 		Used for logging only. Please make sure in other ways that the elem isn't bound to
	*								 the wrong/another binder instance
	*/
	Binder._findKeyBoundToValue=findKeyBoundToValue;
	function findKeyBoundToValue(elem){
		try{
			if(!elem.hasOwnProperty(KEY)){
				var key,inst,backup=null,instructions=getBindInstructions.call(this,elem);
				loops:
					for(key in instructions){
						for(inst of instructions[key]){
							if(inst.fn=='value'){
								break loops; //break loop without unsetting key vv
							}else if(inst.fn=='text' || inst.fn=='html'){
								backup=key; 
							}
						}
						key=undefined;
					}
				//------ end of loops

				//Regardless if we found anything, set this value so we don't check again until having called forgetElem()
				elem[V_INST]=inst
				elem[KEY]=key||backup
			}

			return elem[KEY];

		}catch(err){
			(this._log||bu._log).makeError('Failed to identify key bound to value',elem,instructions,err).throw();
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
		document.body.addEventListener('focusin',function parseElemOnFocus(event){parseElem(event.target)});

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
		bu.markInputting(Binder._staticOptions.inputDebounce);


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
		
			//...and update the value on every change. 
			//my not be a good idea to bind textboxes where users write a whole novel...
			self.set(key,value,{target:event.target,src:'input'});
			//NOTE: if the input changes rapidly/frequently and all intermittent values are NOT of interest
			//      you can either: a) throttle the events being emitted by the input, and/or b) use the 
			//      'throttle' or 'debounce' options of the underlying Smarty to afffect the 'change' events
			//		comming from it and handled by dataEventCallback() here

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
	* Prepare the binder to be used. Now calling is only done to setup the initial state and make sure
	* the initial input event gets parsed, after that it will have happened anyway...
	*
	* @return <Binder>
	*/
	Binder.prototype.setup=function(){
		if(this._private.isSetup){
			this._log.warn('Setting up binder again...');
		}else{
			this._log.debug('Setting up binder...');
			this._private.isSetup=true;
		}
		//Parse all instructions so they're ready to go (for speed later). This is also necessary in
		//case there are inputs, else the first input event will be missed.
		this.parseAllElems();

		//Before outputting anything, scrape for any data so we can save it for intentional later use and/or
		//so we can warn that you might have forgot to call .scrape('assign')
		if(!this._private.scraped && !bu.isEmpty(this.scrape('return'))){
			this._log.warn("Possibly overwriting data already in the DOM. Did you forget to call .scrape() "
				+"before .setup()? Remember, keys which only exist in the DOM will be set to their Binder-"
				+"value which is 'undefined' (which in turn may set certain inputs to their default value)"
				,{inDom:this._private.scraped,inBinder:this.copy()});
		}

		//Output initial data to the DOM.
		this.triggerUpdate();
			

		return this;
	}


	/*
	* Although it will happen automatically when the information is needed, this method will
	* parse all bound elems right now
	*
	* @return <Binder>
	*/
	Binder.prototype.parseAllElems=function(){
		this.getOutputs().forEach(parseElem.bind(this));
		return this;
	}



	/*
	* Scrape for data on all nodes connected to this binder. The scraped data will be stored on this._private.scraped
	*
	* @param string whatToDo 	Accepted values:
	*								'assign' --> default. assigns the scraped data and returns <Binder>
	*                               'return' --> returns the scraped data without assigning it
	*
	* @return object|<Binder>
	*/
	Binder.prototype.scrape=function(whatToDo='assign'){
		this._log.trace("Scraping DOM for values...");

		//First get all the data...
		var data={}, self=this;
		this.getOutputs().forEach(function scrapeDataCallback(node){
			let key=findKeyBoundToValue.call(self,node);
			if(!key)
				return;
			let value=bu.getValueFromElem(node);
			if(value===undefined || value==='')
				return;
			if(data.hasOwnProperty(key) && data[key]!=value)
				this._log.warn(`Found different values for key '${key}' while scraping. Using the latter:`,data[key],value)
			data[key]=value;
		})

		//Store it both for later access AND as a way to check if it's been done
		this._private.scraped=data;

		//...then decide what to do with it
		if(whatToDo=='return'){
			return data;
		}else if(whatToDo!='assign'){
			this._log.warn("E_INVAL. scrape() is defaulting to action 'assign'. Passed in value is not valid:",whatToDo);
		}
		this.assign(data);
		return this;
	}







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
			//If we're still running that means x is a string or undefined...

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


//STOPSTOP 2020-04-08: If this.get() returns undefined, should be really propogate... because with initial values that
//						could create issues eg. when setting a range input which will cause it to set to the middle value instead

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

					for(inst of instructions.values()){
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