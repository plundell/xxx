//simpleSourceMap=/my_modules/xxx/xxx-repeat.class.js
//simpleSourceMap2=/lib/xxx/xxx-repeat.class.js
'use strict';
/*
* @component Repeater
* @part-of xxx-framework
* @author plundell
* @license Apache-2.0
* @description Repeaters use standalone/underlying smarties.Array to repeat templates within a target element 
*              in the DOM. 
* @note: This component is required by ./xxx.proto.js, you should not need to access it directly.
* @depends libbetter
* @depends ./xxx.binder.js
* @depends ./xxx.proto.js
* @depends smarties.Array
* @exports {function} Call this function with the dependencies to get the Repeater constructor
*
* @protip *Nested binders* If each clone is to contain mutiple pieces of data, then the value of the
*		   smarties.Array should be used to set classes/data-bind attributes on children of
*		   the clone for a seperate Binder to use
*
* @emit new       Emitted when a <HTMLElement> is added, ie. when .show() is called it's emitted for every item of underlying smarty
* @emit change
* @emit delete    Emitted when a <HTMLElement> is removed, ie. when .hide() is called it's emitted for every item of underlying smarty
* @emit move
*
* @listens update(i) 	Causes an item on the repeater to be re-drawn (ugly hack if changes are not automatically detected)
*
* DEPRECATED: If you see empty arrays / instructions it was the old way of preventing Repeater
*			  from warning when you intentionally wanted no actions. The new way is to use
* 				'{"x":"noaction"}'
*
* Terminology:
*  "Pattern":            ** NOTE ** pattern==key 
*		Repeaters use pattern instead of regular keys in order for format the value passed to
*		action functions. The pattern can also make use of the index. Examples:
*			index=1, value='red', pattern='#' 			=> 	1
*			index=2, value='blue', pattern='$'			=>	'blue'	
*			index=3, value='green', pattern='#-$'		=>	'3-green'
*			index=4, value={foo:'bar'}, pattern='$'		=>	{foo:'bar'} 		*live object
*			index=4, value={foo:'bar'}, pattern='foo'	=>	'foo' 				*probably not what you want
*			index=4, value={foo:'bar'}, pattern='${foo}'=>	'bar'
*			index=4, value={foo:'bar'}, pattern='#$'	=>	"4{'foo':'bar'}"	*probably not what you want
*			index=6, value={foo:'bar',me:{age:30}}, pattern='#-${me.age}${foo}#hat'
*														=>	"6-15bar6hat"  
*
*
*/

//Export
module.exports=function exportRepeater(dep,proto){


	const Binder=proto.Binder
	const bu=dep.BetterUtil

	const devmode=ENV=='development';


	const TAG_RID='repeat-index-dependent';

	



	/*
	* @param string             targetClass
	* @param object             options 			@see defaultOptions
	* @param array|smarties.Array  data
	*
	*
	* NOTE: the template will not be removed from the html (unless it's inside the target which will always be emptied), so it 
	*		should be hidden or inside a template tag
	*
	* @extends BetterEvents	
	*/
	function Repeater(targetClass,options=undefined){
		try{
			//Call parent constructor. This will make sure the targetClass is unique, setup inheritence to BetterEvents,
			//create this.log and this._private 
			proto.XXX.call(this,'Repeater','xxx-repeat',...Array.from(arguments));

			//Binder and Repeater differ from Navigator in that they use an underlying smart data source...
			proto.prepareForData.call(this,dep.Smarties.Array);

			//Register all default actions (devnote: called seperately because all classes may not wish to implement the same actions)
			proto.setupActions.call(this);



			this._private.onTemplateFail=bu.stringToNode(`<span class="${this.targetClass}" xxx-repeat-text="<repeat-error>$"></span>`);


			//Getting out of sync with our data-smarty is bad, and the only real way to get back in sync is to
			//re-populate... but we don't want to do it on every event since they may come in bursts, so the moment
			//we sense something wrong we trigger a rebuild but we wait out any immediate events first...
			this._private.rebuildTimeout=bu.betterTimeout(1000,this.repopulateTarget.bind(this), this.log);
			this._private.rebuildTimeout.onError=(e)=>this.log.error("Could not recover from ESYNC",e);
			 //This is triggered from dataEventCallback()

			/*
			* @prop boolean indexDependentPatterns 	Patterns can use the index of an item ('#'). If any do (either the
			*										choice of template, or any of the template nodes) this flag needs  
			*										to bet set true which will cause a 'change' event to fire anytime 
			*										the order of the array is affected. This implies that anytime you 
			*										alter the order of the array (ie. anything other than adding/deleting 
			*										the last item or merely 
			*										changing items in place) you have to run a 'change' event for ALL
			*										the affected indexes, which is slow, which is why we don't do it 
			*										unless we have to.
			* @private
			*/
			var indexDependentPatterns=false;
			Object.defineProperty(this._private,'indexDependentPatterns',{enumerable:true,
				get:()=>indexDependentPatterns
				,set:(str)=>{
					if(!indexDependentPatterns){
						if(str && devmode){
							this.log.warn("Possible slowdown! By using patterns with '#', every time you alter the "
								+"order of items (ie. by adding/deleting/moving items in the middle) a 'change' event "
								+"will fire.");
						}
						indexDependentPatterns=str;
					}else if(indexDependentPatterns!=str){
						indexDependentPatterns='both';
					}

				}
			})


		}catch(err){
			proto.getLogAndOptions(this).log.throw('Failed to setup Repeater.',err,arguments);
		}
	}
	Repeater.prototype=Object.create(proto.XXX.prototype)
	Object.assign(Repeater.prototype,proto.BinderRepeaterPrototype); //add common methods
	Object.defineProperty(Repeater.prototype, 'constructor', {value: Repeater});




	
	//Static class variables
	Object.assign(Repeater,proto.static);
	Object.defineProperties(Repeater,{
		
		//Attribute set on target to identify it as such, for debugging and for when repeaters are used within templates
		_targetMark:{value:'repeater-target'}
		
		//Attribute set on each item in a target... not really used for anything except debug clarity
		,_itemMark:{value:'repeater-item',configurable:true}
		
		,_instances:{value:dep.BetterLog.BetterMap()}
		,_defaultOptions:{value:{
			eventType:'local'//used by smarties.Array created here - ADDED 2020-09-08
			,moveEvent:true //used by smarties.Array created here
			,addGetters:true //used locally and by smarties.Array created here
			,target:null
			,template:`<span xxx-repeat='[{"value":"#"}]'></span>`
			,debugMode:true //Attributes will be left/added to nodes for debug clarity
			,cloneTemplateRepeaters:false //if true any repeaters in the templates will be cloned when the template is used
			,groupChanges:0 //if >0 a delay will be added to the data and changes applied in bursts
			,emptyPatternOK:false //if true applyPattern() will NEVER warn when it returns empty string||undefined 
			,emptyDataOK:false //if true this.show() won't warn that this repeater contains no items
			,breakOnHide:true //if a node is hidden, no other instructions are processed for that node
		}}
	});




	/*
	* Find all nested repeaters in a given element (can be any element in the DOM)
	*
	* @param <HTMLelement>  elem 
	* @param bool 			onlySetup  	Default false. If true only child repeaters that have been setup are included
	*
	* @return array(<Node>,...) 	Array of nodes, each having a ._repeater property. The deepest one first
	*/
	Repeater.findNestedRepeaters=function(elem,onlySetup=false){
		bu.checkType('node',elem)

		var	nestedTargets=Array.from(elem.querySelectorAll(`[${Repeater._targetMark}]`));

		if(nestedTargets.length && onlySetup)
			return nestedTargets.filter(target=>node._repeater.isShowing());
		else
			return nestedTargets;
	}


	/*
	* Hide all repeaters nested under a certain element
	*
	* @param <HTMLelement>  elem 
	*
	* @return array   An array of the repeaters we hid
	*/
	Repeater.hideNestedRepeaters=function(elem){
		//First we need to find and hide any nested Repeaters. We want to hide the deepest one first...
		var nodes=Repeater.findNestedRepeaters(elem,true); //true=>only get those showing...
		if(nodes.length)
			//Sort them by depth so we remove the deepest ones first
			bu.sortByDepth(nodes).forEach(node=>node._repeater.hide());
		
		return nodes;
	}







	/*
	* @get number    The *visible* number of children on this repeater
	*                  >0  The repeater is currently showing with this many items
	*                   0  No elements are showing, either because the data is empty or because the repeater is hidden with no 'empty template'
	*		           -1  The 'empty template' is currently showing  
	*/
	Object.defineProperty(Repeater.prototype, 'length', {get: function(){
		if(this.target && typeof this.target.childElementCount=='number'){
			if(this.target.childElementCount==1 && this.target.children[0].hasAttribute('xxx-repeat_showonempty'))
				return -1
			else
				return this.target.childElementCount; //can be zero
		}else{
			return 0;
		}
	}}); 


	/*
	* Show the empty template if applicable
	* @return boolean 	True if it was shown now, else false
	* @call(<Repeater>)
	*/
	function showEmpty(){
		if(this.target && this.length==0 && this.data.length==0){
			for(let i=this.templates.childElementCount-1;i>-1;i--){
				let temp=this.templates.children[i];
				if(temp.hasAttribute('xxx-repeat_showonempty')){
					let clone=temp.cloneNode(true)
					this.log.debug("Showing 'empty node':",clone);
					this.target.appendChild(clone); 
					return;
				}
			}
		}
	}

	/*
	* Hide the empty template if applicable
	* @call(<Repeater>)
	*/
	function hideEmpty(){
		if(this.length==-1){
			this.log.debug("Removing 'empty node'");
			this.target.removeChild(this.target.children[0]);
		}
	}











































	/*
	* Setup this repeater, ie. start propogating private data to DOM. Opposite of destroy() which removes all DOM data.
	* Think of these two methods as show and hide.
	*
	* NOTE: This method can be called multiple times if we call destroy() inbetween.
	* NOTE2: Template is only parsed on first call to this method
	* NOTE3: Unlike showData(), if data is already set and we pass new data here it will only replace the contents
	*        of the existing <SmartArray>
	*
	* @opt array data
	*
	* @return this
	*/
	Repeater.prototype.show=function(data){

		//If we got new data that means we can't reuse any elements we've hidden...
		if(data)
			delete this._private.lastHide; 
		
		//Make sure we have a data source
		proto.createReplaceOrVerifyDataExists.call(this,data);
		 //^ see func body... throws if not in the right sequence


		if(this.isShowing()){
			this.log.debug("Repeater already showing...",this);

		}else{
			//On first call to show() we parse/prepare the template. 
			if(!this.templates || !this.templates.childElementCount){
				proto.prepareTemplates.call(this); //will use this._private.options.template, may set .options.target
				  //^this throws if we don't get any valid templates
			}

			//On each call to show() we fetch the target a-new... this in case the old target has been eg. hidden by
			//a parent repeater and then re-created (ie. it'll be a new element)
			prepareTarget.call(this); //will use this._private.options.target, which may come from ^
		

			//Start listening to the smarty so we can propogate changes to dom
			proto.listenToData.call(this);
			

			//Finally poplate the target with any existing data, this will finally SHOW something
			if(this._private.lastHide && this._private.lastHide.version==this.data._private.version){
				this.log.info("Nothing changed in data since last hide, re-using those elements");
				this.target.appendChild(this._private.lastHide.docfrag);

				//TODO: do we need to re-show nested repeaters?
			}else{
				addAll.call(this);
			}
			  //DevNote: the following scenario will create "duplicate event" warnings in dataEventCallback:
			  //   new smarty --> smarty.assign(data, not-silent) --> new repeater --> repeater.show(smarty)
			  //because the creation, assignment and addAll will be sync, and then the async events from assign will
			  //cause the same events to try and be added again... 


			if(this.data.length){
				this.log.debug("Repeater is now showing ");

				//Emit new events for all items (also done in dataEventCallback)
				for(let [key,value] of this.data.entries()){
					this.emit('new',{src:'show',index:key,value,target:this.target.children[key]});
				}
			}else{
				showEmpty.call(this);

				//To help bring attention to possible bugs... we probably don't want to show an empty repeater
				if(!this.length && !this._private.options.emptyDataOK){ //this.length will return -1 if showEmpty() showed stuff...
					this.log.note("Showing EMPTY repeater:",this);
					setTimeout(()=>{
						if(this.isShowing() && !this.length){
							this.log.warn("An empty repeater has been showing for 3 seconds now... is that intentional?",this);
						}
					},3000)
				}else{
					this.log.debug("Repeater IS now showing, there just aren't any items");
				}
			}
		}

		delete this._private.lastHide;

		return this;
	}

	Repeater.prototype.setup=function(){
		this.log.throw("DEPRECATED. Please use repeater.show() instead of repeater.setup()");
	}








	/*
	* The opposite of 'show()', remove all items from the DOM (but keep the data/smarties.Array). This can be reversed 
	* again with 'show()'
	*
	* @return this
	*/
	Repeater.prototype.hide=function(force=false){		
		if(force||this.isShowing()){
			this.log.debug(`Going to stop listening to private data and empty target of elements.`,this);

			//Stop propogating changes to DOM
			proto.stopListeningToData.call(this);

			//Remove any items from target and store them in case we show again before anything changes
			this._private.lastHide={
				version:this.data._private.version
				,docfrag:emptyTarget.call(this)
			};
			 //NOTE this may remove more than our nodes if someone has put stuff in the target... that's a fail-safe so we can always continue

			//Emit delete events for all items (also done in dataEventCallback)
			for(let [key,value] of this.data.entries()){
				this.emit('delete',{evt:'delete',src:'hide',index:key,value,target:this._private.lastHide.docfrag.children[key]});
			}

		}else{
			this.log.trace("Repeater not showing, nothing to hide",this);
		}

		return this;
	}






	/*
	* The function which .setup() will use to listen for the 'event' event on ._data. This func either moves
	* existing nodes around, or it creates new ones/alters existing ones
	*
	* NOTE: This func is bound to this instance by constructor and stored on ._private. That way each instance
	*		gets a unique version of it that can be identified and removed when multiple Reapeaters share the
	*		same underlying SmartArray
	*
	* @emit new 			{src,evt,index,target,value}
	* @emit delete 			{src,evt,index,target,value}  //old value and deleted elem
	* @emit change          {src,evt,index,target,value}  //new value and new elem
	*
	* @return void
	* @no-throw
	* @bind(this)
	*/
	Repeater.dataEventCallback=function dataEventCallback(event){
		// evt,i,value,old,oldIndex
		try{
//TODO 2020-09-02: to minimize reflow, if opted, buffer events from smartarray and then try to apply them in blocks...

	//TODO 2020-04-01: We're allowing complex values, but we can't handle nested keys here... so just
	//					make sure we havn't got one
	//TODO 2020-09-04: That probably means that we have to make sure the the smarty emits based on local change, or that
	//					we here change the event...
	//TODO 2020-09-15: Do we want to allow partial changes? OR do we only want to re-run actions for those keys that have changed?
			if(isNaN(Number(event.key))){
				this.log.error("BUGBUG: Repeaters can't handle nested keys, we're only interested in "
					+"what happens with the local array",event);
				return;
			}
			this.log.trace("Handling event:",event);
				
			var elem,indexesAffected,rEvent={src:event.src||'data',index:event.key,evt:event.evt}

			//The 'new' event is the only where elem doesn't need to exist, so do that first...
			if(event.evt=='new'){
				//Hide the 'empty node' if it's showing
				hideEmpty.call(this);

				//The following scenario would create duplicate items unless we stop it here:
				//    new smarty --> smarty.assign(data, not-silent) --> new repeater --> repeater.show(smarty)
				//because the creation, assignment and addAll will be sync, and then the async events from assign will
			  	//cause the same events to try and be added again
				if(this.length>=this.data.length)
					this.log.makeError(`Got 'new' event for item #${event.key} but all items seem to already be showing.`
						,this[event.key],event,this).addHandling("Preventing propogation").throw('ESYNC');

				elem=insertItem.call(this,event)

				//Get effected range AFTER adding
				let last=this.length-1;
				if(this._private.indexDependentPatterns && event.key<last){
					indexesAffected=bu.range(event.key+1,last);
				}

				if(elem.hasAttribute('autoclone-repeaters')){
					//ProTip: If you only want a specific nested repeater to be automatically cloned you can leave options.cloneTemplateRepeaters=false
					//        and instead set this attribute manually on a node
					autoCloneRepeaters(elem);
		//TODO 2020-10-01: wouldn't this have to be done every time we insertItem()?
				}

			}else{
				elem=this.target.children[event.key]
				//...for all the rest it must, so check
				if(bu.varType(elem)!='node'){
					this.log.error("Child #"+event.key+" does not exist, cannot propogate event: "+event.evt);
					return;
				}

				switch(event.evt){
					case 'indexChange':
						// This case is almost a copy of 'change'v

						//We use the .indexDependentPatterns prop to make sure we're not checking unecessarily 
						//where we KNOW patterns don't contain '#'
						if(this._private.indexDependentPatterns!='i' && !elem._keepSameTemplate(event)){
							rEvent.evt='change';

							elem=insertItem.call(this,event,'replace');
							 //^elem is now the NEW item
							this.log.debug(`Changed templates for elem #${event.key}. This is the new one:`,elem);

						}else{
							//This is not a repeater event...
							rEvent=null;

							if(this._private.indexDependentPatterns!='t' && elem.hasAttribute(TAG_RID)){
								propogateToNodes.call(this,elem,event,'onlyIndexPatterns')
							}else{
								this.log.trace("Ignoring elem without index dependent pattern.",event,elem)
							}
						}
						
						break;

					case 'update': 
						//Not emitted natively by smarties. Can be manually emitted to force re-draw (useful when using getters 
						//in patterns). Since nothing actually changed on the underlying data we set .value and .old to the same thing
						event.value=event.old=this.get(event.key);
						rEvent.evt='change';
						//don't break
					case 'change': 
						if(!elem._keepSameTemplate(event)){
							elem=insertItem.call(this,event,'replace');
							 //^elem is now the NEW item
							this.log.debug("Changed templates for elem #"+event.key,elem);
						}else{
							propogateToNodes.call(this,elem,event)
						}
						// this.doubleEmit('nodeChange',elem,value,oldValue);
						break;

					case 'delete':
					 	this.log.debug('Removing repeater elem #'+event.key,elem);

					 	//Get effected range BEFORE deleting
					 	let last=this.length-1;
					 	if(this._private.indexDependentPatterns && event.key<last){
					 		indexesAffected=bu.range(event.key,last);
					 	}

						// this.target.removeChild(elem);	
						gracefullyRemoveElement.call(this,elem); 

						if(this._private.options.addGetters){
							//It just got one shorter, so remove the last getter
							delete this[this.length];
						}

						//If that was the last element, show the 'empty node' if one exists
						if(!last){
							showEmpty.call(this);
						}

						break;

					case 'move':
						this.log.debug('Moving repeater elem #'+event.from+" to #"+event.to,elem);
						
						if(this._private.indexDependentPatterns){
							indexesAffected=[Math.min(event.from,event.to),Math.max(event.from,event.to)];
						}

						this.target.insertBefore(elem, this.target.children[event.to]);

						//Not a repeater event
						rEvent=null;


						break;


					default:
						this.log.note('Unhandled event: '+event.evt);
				}
			}

			//If we affected any indexes...
			if(indexesAffected){
				// ...just call this same method again saying that index has changed. It's not the fastest way of doing it,
				//but at least it works
		//TODO 2020-04-01: Make sure this is correct...
				indexesAffected.forEach(key=>dataEventCallback.call(this,Object.assign({},event,{evt:'indexChange',key,old:event.value})))
					//^be clear that the old value hasn't changed
			}

			//If we havn't deleted the event yet...
			if(rEvent){
				rEvent.target=elem;
				this.emit(rEvent.evt,rEvent);
			 	//NOTE: This is also done by .show() and .hide()
			}


			
		
		}catch(err){
			if(err.code=='ESYNC'){
				this.log.warn("Target out of sync, triggering re-build...",err);
				this._private.rebuildTimeout.trigger();
			}else
				this.log.error("BUGBUG",err,event);
		}
	}



	Repeater.prototype.triggerUpdate=function(which){
		switch(bu.checkType('node','nodelist','array','number','undefined')){
			case 'number':return this._private.dataEventCallback({evt:'update',key:which,src:'triggerUpdate'});
			case 'undefined':return this.keys().forEach(key=>this.triggerUpdate(key));
			default: 
				//Since we need a key/value we have to group nodes according to which item they exist under...
				var groupedNodes=this.groupNodesByKey(this.getNodesWithInstructions(which));
				for(let i in groupedNodes){
					let val=this.get(i);
					propogateToNodes.call(this,groupedNodes[i],{evt:'update',key:i,value:val,old:val,src:'triggerUpdate'})
				}
				return;
		}
	}

















	/*
	* Get all nodes with instructions for this instance or under a certain parent, based on if they have the targetClass set
	*
	* @opt <HTMLElement>|array[nodes...]|nodelist nodeOrNodes 	
	*
	* @return array[<HTMLElement>] 	If a single node was passed in it may be included
	*/
	Repeater.prototype.getNodesWithInstructions=function(nodeOrNodes){
		nodeOrNodes=nodeOrNodes||this.target;

		switch(bu.checkType(['node','nodelist','array'],nodeOrNodes)){
			case 'array': 
				nodeOrNodes=nodeOrNodes.filter(node=>bu.checkType('node',node,true));
				//don't break
			case 'nodelist': 
				return Array.from(nodeOrNodes).filter(node=>node.classList.contains(this.targetClass));
			case 'node': 
				var nodes=Array.from(nodeOrNodes.getElementsByClassName(this.targetClass));
				if(nodeOrNodes.classList.contains(this.targetClass)){
					nodes.push(nodeOrNodes);
				} 
				return nodes;
		}
	}

	/*
	* @return object 	Keys match the keys of this, values are arrays of nodes
	*/
	Repeater.prototype.groupNodesByKey=function(nodes){
		var groups={},children=Array.from(this.target.children),c
		for(let node of nodes){
			if(typeof c!='number'||!bu.isDescendantOf(node,children[c])){
				find:{
					for(c in children){
						if(bu.isDescendantOf(node,children[c]))
							break find;
					}
					c=null;
				}
			}
			if(typeof c=='number'){
				groups[c]=groups[c]||[];
				groups[c].push(node);
				break;
			}
		}
		return node;
	}


	/*
	* Check if everything is setup and ready for insertion
	*
	* @throws <ble ESEQ> 	If we're not ready to insert
	*
	* @return void
	*/
	function readyToInsert(){
		try{
			bu.checkTypes(['node','<DocumentFragment>'],[this.target,this.templates])
		}catch(err){			
			this.log.throwCode("ESEQ","Trying to insert before this.templates and this.target have been set.",this);
		}

		if(!this.templates.childElementCount)
			this.log.throwCode("ESEQ","this.templates is empty, will not be able to create new item",this);

		//Since we're inserting new data that means our data array should be longer than the number or elements in our target,
		//and if that is not the case we're out of sync
		if(this.data.length<this.length)
			this.log.throwCode('ESYNC',`There are ${this.length} elements in the target, but only ${this.data.length}`
				+" items in the data array: the target is out of sync",{
					target:this.target
					,smarty:this.data
					,snapshot:{//so we know what was going on when the error happened
						children:Array.from(this.target.children) 
						,data:this.data.copy()
					}
				});
	//2020-09-02: removing this restriction... why would it half to be? 
		// if(this.target.ownerDocument!=document)
		// 	this.log.throwCode("EDOMCHANGED","The target is no longer part of this document:",this.target);


	}


	/*
	* Add an item to the target
	*
	* @param object event
	* @opt bool replace 	Default false. If true an existing item will be replaced => only 1 reflow
	*
	* @return node 		The newly created clone
	* @call(this)
	*/
	function insertItem(event,replace=false){
		//Sanity check unless calling from...
		if(event.src!='addAll'){
			readyToInsert.call(this);
			if(event.key<0||event.key>this.length)
				this.log.throwCode("ERANGE",`Cannot insert item at index ${event.key} when length is ${this.length}`,this);
		}


		try{		
			//Start by cloning and preparing a template
			var clone=chooseAndCloneTemplate.call(this,event.key,event.value); //throws if no template is found
			var childrenWithInstructions=prepareClone.call(this,clone);

			//Then fill the new clone with data
			propogateToNodes.call(this,clone,event)
			
			this.log.makeEntry('debug',"Prepared new repeat item:",clone)
				.addHandling('Children with instructions:',childrenWithInstructions)
				.addHandling('Data:',event)
				.exec();
		}catch(err){
			var clone=this._private.onTemplateFail.cloneNode(true);
			this.log.error("Failed to get template. Substituting _private.onTemplateFail to keep Repeater "
				+"in-sync with underlying data",err,clone,event);

			clone._keepSameTemplate=function(){return false;} //never the right template, which forces the repeater to try again
															//when data changes			
		}

		if(event.key==this.length){
			this.target.appendChild(clone);
		}else{
			let current=this.target.children[event.key];
			if(replace){
				//To make the replacement with only 1 reflow we replaceChild() first and then hide any
				this.target.replaceChild(clone,current);
				Repeater.hideNestedRepeaters(current); //2020-09-15: doing it this order should work....
			}else{
				this.target.insertBefore(clone, current); //insert before the current child in that position
			}
		} 

		if(this._private.options.addGetters && !replace){ //don't add getter if we just replaced
			//Regardless where the item was inserted, the total length has increased, so add a public getter
			let last=this.length-1
			Object.defineProperty(this,last,{enumerable:true,configurable:true,get:()=>this.target.children[last]});
		}

		
		return clone;
	}







	/*
	* Remove an element AFTER first checking for any nested repeaters and hiding those...
	*
	* @param element elem
	*
	* @return elemment  			Same as passed in
	*
	* @call(<Repeater>)
	*/
	function gracefullyRemoveElement(elem){

		if(Repeater.hideNestedRepeaters(elem).length){
			this.log.debug("Done hiding children, now removing this elem:",elem)
		}else{
			this.log.debug("No nested repeaters found, just removing this elem:",elem);
		}

		return elem.parentNode.removeChild(elem);
	}





	/*
	* Remove all items from target, even those not created by this repeater
	*
	* @return <DocumentFragment>  containing all the removed items
	*
	* @call(<Repeater>)
	*/
	function emptyTarget(){
		
		this.log.debug(`Emptying target of all ${this.length} elements:`,this.target);

		//To minimize reflow we replace the target with an empty clone, remove all elements from the real one, 
		//then reinsert it. This is however not necessary if we...
		if(this.isShowing()&&this.length>1?true:false){ //... only have one child or if the we're not showing
			var clone=this.target.cloneNode();
			this.target.parentNode.replaceChild(this.target,clone);
		}
		
		var removedItems=document.createDocumentFragment();
		while(this.target.childElementCount){
			removedItems.appendChild(gracefullyRemoveElement.call(this,this.target.firstElementChild));
		}

		//Revert if needed
		if(clone)
			clone.parentNode.replaceChild(clone,this.target);

		//Remove all public getters
		if(this._private.options.addGetters){
			var p,d;
			for(p of Object.getOwnPropertyNames(this)){
				try{
					d=Object.getOwnPropertyDescriptor(this,p);
					if(d.enumerable==true && typeof d.get=='function'){
						delete this[p];
					}
				}catch(err){
					this.log.error("Problems while deleting public getters. Current prop: "+p,err,d);
				}
			}
		}

		return removedItems;
	}


	/*
	* Propogate all items on underlying smarties.Array to DOM
	*
	* NOTE: This function needs to be .call(this,...)
	*
	* @throws Error 	If target is not empty
	* @return void
	* @call(<Repeater>)
	*/
	function addAll(){
		if(this.target.childElementCount){
			this.log.throw("Target is not empty, cannot add items since it may create duplicates",this.target);
		}

		if(this.data.length){
			this.log.debug(`Going to add all ${this.data.length} items to target:`,this.target);
			readyToInsert.call(this); //do one sanity check instead of letting it be done in every loop vv
			
			//In order to only get one reflow we temporarily set the target to document fragement, populate that, then move
			//all the items into the real target in one swoop
			var realTarget=this.target;
			Object.defineProperty(this,'target',{configurable:true, value:document.createDocumentFragment()});
			for(let i of this.data.keys()){
				let value=this.data.get(i);
				insertItem.call(this,{value,key:i,src:'addAll'})
				  //^since there was no 'event' we skip the key 'evt' and 'old'
			}
			realTarget.appendChild(this.target);
			Object.defineProperty(this,'target',{configurable:true, value:realTarget});
		}

		//And lastly as a sanity check we make sure both data and target have the same number of items
		if(this.length!=this.data.length){
			this.log.throw(`Something went wrong, there are ${this.data.length} data items, but ${this.length} DOM items`
				,{target:this.target, data:this.data});
		}else if(this.data.length){
			this.log.trace(`All ${this.data.length} items added`);
		}else{
			this.log.trace(`There are no items in the SmartArray, so no DOM items to add`);
		}

		return;
	}



	/*
	* Remove all items from target, then add them back. Can be used if for some reason we're out of sync between
	* data and DOM items
	*
	* @return this
	*/
	Repeater.prototype.repopulateTarget=function(){
		emptyTarget.call(this);
		addAll.call(this);
		return this;
	}













	/*
	* Prepare the live target element (ie. where copies of the template will be inserted)
	*
	* NOTE: This method removes the template if it exists inside the target
	* 
	* @throws TypeError         Refers to options.target or .template
	* @throws ENOTFOUND         Refers to options.target or .template, if it's an id that doesn't exist
	* @throws EINVAL            If target is not part of this document or .target/.template not specified
	* @throws ENOTEMPTY         If the target is not empty
	*
	* @return void
	* @set this.target <HTMLElement>     The live target element
	*
	* @call(this)
	*/
	function prepareTarget(){
		this.log.traceFunc(arguments);

		//NOTE: we've set .target in prepareTemplates() if applicable
		if(this._private.options.target){
			var target = bu.getLiveElement(this._private.options.target); //throws TypeError or ENOTFOUND
		}else{
			this.log.throwCode("EINVAL","Bad options: no target specified and template didn't have a parent.",this._private.options);
		}

		//If we have a target from before, check if they're the same
		if(this.target==target){
			this.log.trace("The target hasn't changed:",target);

		}else{

			let args={new:target};if(this._private.options.target!=target){args.identifier=this._private.options.target};
			if(this.target){
				args.old=this.target;
				this.log.note("Switching to new target:",args);
			}else{
				this.log.debug("Using target:",...Object.values(args));
			}

			if(target.ownerDocument!=document)
				this.log.note("The target is not part of this document:",target);
			//2020-09-22: the ownerDocument doesn't change when inserting/removing, only when adopting. even nodes in doc-frags are part of this document

			//If the templates are inside the target, time to get rid of them...
			if(target.firstElementChild && target.firstElementChild.content==this.templates)
				target.removeChild(target.firstElementChild); 
				 //^NOTE: we remove the entire <template> tag, not just the DocumentFragment containing the templates
			
			//Everything is good! Mark it with a flag which we use when checking for nested repeaters (and for debug clarity)
			target.setAttribute(Repeater._targetMark,this.targetClass);
			
			//...aaand set a ref on the node to this repeater
			target._repeater=this;
			Object.defineProperty(this,'target',{enumerable:true,configurable:true,value:target});
		}
		
		//Finally make sure the target is empty
		if(target.childElementCount>0)
			this.log.throwCode("ENOTEMPTY","Repeater targets must be empty.",target);
		
		return;
	}







		






	/*
	* Count how many nested repeaters exist within this repeaters target. Can be good if you want to 
	* limit how many repeaters are being created...
	*
	* @opt bool onlyCountSetup      Default false. Only count those that are setup (which may not mean that they are
	*								actually showing since some parent may be hidden
	*
	* @return number
	*/
	Repeater.prototype.countNestedItems=function(onlyCountSetup=false){
		if(!this.length || !this.target)
			return 0;
		return Repeater.findNestedRepeaters(this.target,onlyCountSetup).length;
	}



	/*
	* Sometimes a template can contain a live repeater, eg. a table row with a dropdown who's items are dynamic. For
	* each new row of the table we have to clone the repeater keeping the dropdown up to date, ie. every dropdown on 
	* every row gets it's own repeater which uses the same data source as that in the template
	*
	* @param <HTMLElement> item 	A newly created item on this repeater 
	*
	* @call(<Repeater>)
	*/
	function autoCloneRepeaters(item){
		//First get a list of the repeaters we're cloning...
		var clsList=item.readAttribute('autoclone-repeaters').split(',');

		//Then start looping...
		for(let target of Repeater.findNestedRepeaters(item)){
			try{
				//Any repeaters we're not cloning...
				if(!clsList.includes(target.getAttribute(Repeater._targetMark)))
					continue;

				//The rest should definately not have a ._repeater set on them... but if $item was not newly created...
				if(target._repeater)
					this.log.throwCode('EEXISTS',"BUGBUG: trying to clone a nested repeater, but someone has already"
						+" set this one on it:",target._repeater);

				//Create a new repeater based on the old repeater
				let oldClass=target.getAttribute(Repeater._targetMark)
					,oldRepeater=Repeater._instances[oldClass]
					,newClass=Repeater.getUniqueTargetClass(oldClass) 
	 //TODO 2020-09-22: For stuff that hides/shows a lot we should try to keep repeaters... but how do we know that the same repeater is being created
	 //                 since these classes are not unique... maybe it's best to simply move items into a doc-frag when hiding, different from .destroy
					,newRepeater=new Repeater(newClass,oldRepeater._private.options,oldRepeater.data)
				;

				//Then change all the class names in the target and set said target on the new one
				for(let nodeWithInst of target.getElementsByClassName(oldClass)){
					nodeWithInst.classList.replace(oldClass,newClass)
				}
				newRepeater._private.options.target=target;
				 //^by setting this we ensure that the template will be cloned into the new repeater

				//Finally we show it!
				newRepeater.show();


			}catch(err){
				self._log.error(err);
			}
		}
	}


	/*
	* Since we're cloning nodes, and may be sharing templates, we can't do all the preparations in prepareTemplates(), 
	* this function does the rest after cloning...
	*
	* @param <HTMLElement> clone 	A newly cloned template
	*
	* @return array 				Array of those child nodes that have instructions
	* @call(<Repeater>)
	*/
	function prepareClone(clone){
		bu.checkType('node',clone);
		document.adoptNode(clone); //2019-05-23: Trying to solve issue with not being able to find by id... //2020-02-10: ???
		
		//Set a few shortcuts and a flag on the clone to help out... _repeatIndex eg. is used by chooseAndCloneTemplate()
		clone.setAttribute(Repeater._itemMark,this.targetClass); 
		Object.defineProperties(clone,{
			_repeater:{enumerable:true,get:()=>this}
			,_repeatIndex:{enumerable:true,get:()=>Array.from(clone.parentElement.children).indexOf(clone)}
			,_repeatData:{enumerable:true,get:()=>this.data.get(clone._repeatIndex)}
		})

		
		//Turn all pre-parsed instructions into live objects
		let nodes=this.getNodesWithInstructions(clone)
		nodes.forEach(node=>{
			Repeater.getInstructions.call(this,node);

			//The attr has now served it's purpose, the only reason to keep it is debugging
			if(!devmode)
				node.removeAttribute('xxxRepeat');
		});

		return nodes;
	}


	/*
	* Get instructions from an element. 
	*
	* NOTE: This method can be called both when preparing templates and later when preparing a clone 
	* NOTE: This is where elems with instructions are given the targetClass
	*
	* @param <HTMLElement> elem
	*
	* @return array|undefined 		An array of objects if instructions exist, else undefined
	* @call(<Repeater>)
	*/
	Repeater.getInstructions=function getRepeatInstructions(elem){
		//If no live object exists on the elem...
		if(!elem.hasOwnProperty('xxxRepeat')){
			//...and no attribute either...
			if(!elem.hasAttribute('xxxRepeat')){
				//...then look for and parse new instructions, saving it to the prop we checked first ^^
				let instructions=proto.getInstructions.call(this
					,elem
					,validateInstruction.bind(this,elem) //callback used to determine we have a good pattern, throw => don't include
					,devmode?'extract':''
					,'emptyOK' //don't warn if individual elems don't have instructions, see prepareTemplates() for details
					,'keyIsPattern' //you can write instructions .key or .pattern and they will mean the same thing
				);
				
				//If we found any, save them, else at least make sure the prop exists so the the prop we checked first^...
				if(instructions.length){
					elem.xxxRepeat=instructions;

					//If any instructions include '#', mark the entire clone/template so we can 
					//quickly identify it in dataEventCallback()
					if(!elem.hasAttribute(TAG_RID) && instructions.find(inst=>inst.pattern.includes('#'))){
						elem.setAttribute(TAG_RID,'');
					}
				}else{

					delete elem.xxxRepeat
				}

			//If it does have the attribute (which will be the case with every new clone)...
			}else{
				//...just make it live and save it to the prop we checked first ^^...
				elem.xxxRepeat=bu.getJsonAttr(elem,'xxxRepeat');
			}
			//REMEMBER: We can't remove the xxxRepeat attribute here, because this method is used on templates too, and like
			//          notes state there we have to keep it until a clone has been made...


			//If we found any instructions...
			if(elem.xxxRepeat){
				//...set this Repeater's targetClass on the elem to mark that it's got instructions
				elem.classList.add(this.targetClass); 

				//ProTip: If you need to change the instructions on a single element you should delete both prop and 
				//		  attr "xxxRepeat", but leave this class/flag. That way the next time propogateToNodes() is 
				//		  called it'll find this elem but will be forced to look for new instructions
			}
		}

		//Now return what may be instructions, or may be undefined
		return elem.xxxRepeat;
	}




	/*
	* Check that an instruction is valid for a Repeater. This mostly deals with the pattern...
	*
	* @param <HTMLElement> elem 		For logging purposes only
	* @param object inst  				Instructions found on a node, parsed into a live object
	*  @prop string|array key|pattern 	Arrays will be converted: ["person","age"] => "${person.age}"
	*
	* @throw <TypeError>  		If pattern isn't string
	* @throw <ble EMISMATCH> 	If complex pattern but this Repeater can only handle primitive children
	*
	* @return void 			
	*
	* @call(this) 		
	*/
	function validateInstruction(elem,inst){

		//Most of the time for repeaters the key is a pattern, so rename it
		inst.pattern=inst.pattern||inst.key
		delete inst.key;

		//Make sure it's a string, (an array can be used to signify a nested get)
		switch(typeof inst.pattern){
			case 'string':
				if(inst.pattern.includes('#')){
					//This will slow things down if we re-order the array often
					this._private.indexDependentPatterns='i';
					this.log.warn("Index-dependent patterns are slow and may be a problem if we re-order the array often:",inst,elem);
				}else if(!inst.pattern.includes('$') && !inst.pattern.includes('?')){
					this.log.warn("This pattern doesn't contain any special characters (#,?,$) -> it's not dynamic. Is that a mistake?",inst,elem);
				}
				break;
			case 'object': //really means it's an array, because getInstructions() has already made sure it's a string|number|array
				inst.pattern='${'+inst.pattern.join('.')+'}';
				break;
			case 'number':
				this.log.makeError("Repeater key/pattern cannot be numbers:",inst.pattern).throw('TypeError');
				break;
		}

		//If we only deal in primitive children, then the pattern can't make reference to any props
		if(this.data._private.options.children=='primitive' && inst.pattern.match(/\$\{([^}]+)\}/))
			this.log.makeError(`options.children=='primitive' => no complex patterns: '${inst.pattern}'`).throw('EMISMATCH');
		 //^the opposite can obviously happen, childen=='complex' but a specific child is primitive...

		
		return;
	}











	/*
	* Choose which template to used based on the value of an item
	*
	* NOTE: Templates are checked in order, and the first match wins
	*
	* @param number index			The index the template is going to be inserted at
	* @param mixed value 		The value of an item of the underlying smarties.Array
	*
	* @throws
	* @return node 			A cloned template, ready to be modified and inserted
	* @call(this)
	*/
	function chooseAndCloneTemplate(index,value){
		var clone;

		//First we clone the template... but there may be multiple, in which case we have to figure out which one...
		if(this.templates.childElementCount>1){
			
			
			//FutureDev: Do not try to prevent additional lookups here. Why? Value could be an object and we can't detect
			//           that a sub-prop has changed. Or a getter may be returning random values... If ANY caching should
			//           happen do so in xxx.proto
			var patterns={}; //this is only for logging purposes for the reason stated ^
			var checkRule=([pattern,operator,criteria],template,index,value)=>{
				try{
					var resolved=patterns[pattern]=proto.static.applyPattern.call(this,index,value,pattern,template,'emptyPatternOK');
					return bu.compare(resolved,operator,criteria);
				}catch(err){
					this.log.error("BUGBUG: Error checking template rule. This should have been prevented when parsing templates"
						,{value:{index,value,pattern,resolved},operator,criteria,template,clone}, err);
					return false;
				}
			}

			let rules=[]
				,ble=this.log.makeEntry('debug',"Choosing which template to use",{templates:this.templates.children,value,index,patterns,rules})
				,template
			;
			block:{
				let dflt,t=0;
				for(template of this.templates.children){
					t++;//for logging 

					if(template.hasAttribute('xxx-repeat_usedefault')){ //we deal with this after all others
						dflt=template; 
						continue;
					}else if(template.hasAttribute('xxx-repeat_showonempty')){ //this never get's inserted when we have a value
						continue;
					}

					//Get the rule which we've already made sure is an array like [pattern,operator,criteria]
					var rule=bu.getJsonAttr(template,'xxx-repeat_useif');

					//store so we can check all rules later if default template is chosen this time
					rules.push(rule); 
					
					//Now check the rule
					if(checkRule(rule,template,index,value)){
						ble.addHandling(`Template #${t} - MATCH!`,template);
						break block;

					}else{
						ble.addHandling(`Template #${t} - No match.`,template);
					}
				}

				if(!dflt){
					ble.msg="No template rules matched, and there is no default."
					ble.setCode('ENOMATCH').exec().throw()
				}
				
				ble.addHandling("No rule matched, using default:",dflt);
				template=dflt;
				rules.push(false); //easy trick to check all rules vv
			}

			//Now we have our a template, let's clone it
			clone=template.cloneNode(true);	

			//When a change happens we need to check if we can use the same rule. REMEMBER: multiple rules can match, but we use
			//the first matching one, so if #4 matched this time, but on change #2 and #4 match then we have to switch.
			clone._keepSameTemplate=(event)=>{
				//Get the current index of the clone, which may have changed from before...
				var newIndex=clone._repeatIndex; 

				//Start by checking the rule that matched last time, if that one doesn't match then we don't need
				//to check any more rules (not applicable if dflt was used ^)
				var last=rules[rules.length-1]; 
				if(last && !checkRule(last,template,event.key,event.value)){ 
					this.log.traceCalled("Template no longer matches.",{template,rule:last
						,oldIndex:index,newIndex:event.key,oldValue:value,newValue:event.value}).storeOnObject(clone,devmode);
					return false;
				}

				//Now check the other rules, any of them match and we have to change
				for(let i=0;i<rules.length-1;i++){ //less than last one, ie. not including last one
					if(checkRule(rules[i],template,event.key,event.value)){
						this.log.traceCalled("Another rule matched, changing templates.") //TODO: Find way to use this knowledge so we don't check again
							.storeOnObject(clone,devmode);
						return false;
					}
				}

				this.log.traceCalled("Keeping same template.",template).storeLastOnObject(clone,devmode);
				return true;
			}

			ble.exec().storeOnObject(clone,devmode);

		}else{
			clone=this.templates.firstElementChild.cloneNode(true);  
			this.log.debug('Only one template existed, cloned that:',clone);
			
			clone._keepSameTemplate=function(){return true;} //Only one option, always the right value
			
		}
		
		return clone;
	}







	

	/*
	* Propogate a value the DOM
	*
	* @param mixed nodeOrNodes 		@see this.getNodesWithInstructions()
	* @param object event 	
	* @param boolean onlyIndexPatterns 	If truthy, only run instructions that contain '#'
	*
	* @return void
	* @call(this)
	*/
	function propogateToNodes(nodeOrNodes, event,onlyIndexPatterns=false){
		if(!event || typeof event!='object'||!event.hasOwnProperty('value')){
			this.log.makeError("Bad event, could not propogate to nodes.",event,nodeOrNodes).setCode('EINVAL').calledFrom().exec();
			return;
		}
		this.log.traceFunc(arguments).storeOnObject(nodeOrNodes,devmode);

		//Loop through all child nodes with instructions (defined as those marked with this.targetClass)
		for(let node of this.getNodesWithInstructions(nodeOrNodes)){
			let instructions=node.xxxRepeat, len, i=0;
			if(!Array.isArray(instructions)||!instructions.length){
				this.log.error('BUGBUG No instructions on node:',node);
			}else{
				let len=instructions.length,i=0;
				try{
					//If a pattern exists, apply it
					//...then loop throught the instructions and apply
					for(i;i<len;i++){
						let inst=instructions[i];

						//If this is an index change, don't run any instructions that aren't index dependent...
						if(onlyIndexPatterns && !inst.pattern.includes('#'))
							continue;

						this.executeAction(node,inst,event);	 //only throws 'break' when we should stop processing instructions
					}
				}catch(signal){
					if(signal=='break'){
						if(len-1-i) // any left...
							this.log.debug("Received 'break' signal. Skipping remaining instructions for node:"
								,{ran:instructions.slice(0,i),skipped:instructions.slice(i)},node);
					}else{
						this.log.error("BUGBUG Unexpected error.",signal,node);
					}
				}
			}
			
		}

		return;

	}




	return Repeater;
}//correct, we do NOT run this function here, see ./require_all.js
//simpleSourceMap=
//simpleSourceMap2=









