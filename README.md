# xxx
A lightweight front-end framework that provides two-way binding, repeating templates and UI navigation

## Outline
The library consists of 3 constructors that each provides one of the above mentioned features; Binder, Repeater, and Navigator. You set instructions straight on HTML <b>elements</b> in the DOM via attributes like 'xxx-bind', then create <b>instances</b> of the classes to consume and execute those actions. Elements are linked to instances via a "target class" which can be added to any elements classList at any time. The classes work together or alone.

## Installation
Install the npm package: `npm -i xxx-framework`.  
 
Optionally you can add dev dependencies if you want to run examples in the browser: `npm -i xxx-framework --save-dev`.

## Usage
To load the framework in the browser you have 2 options:

a) Include the bundled version directly in the browser as you would any script, you will then be able to access it on `window.xxx`, but you'll get an error _until_ you've loaded the dependencies, as so:
```html
<script src="path/to/xxx/dist/xxx.js" type="text/javascript"></script>
<script type="text/javascript">
  try{
    new window.xxx.Binder('foo');
  }catch(err){
    console.error(err); // E_DEPENDENCY
  }; 
</script>
<script src="path/to/libbetter/dist/libbetter.js" type="text/javascript"></script>
<script type="text/javascript">
  console.log(window.xxx); // {Binder: ƒ, Repeater: ƒ, Navigator: ƒ}
</script>
```

b) Require the package into another script, initialize it with it's dependencies, then bundle that.
 ```javascript
 var libbetter=require('libbetter');
 var xxx=require('xxx-framework')(libbetter);
 console.log(xxx); // {Binder: ƒ, Repeater: ƒ, Navigator: ƒ}
 ```
 ```html
<script src="path/to/xxx/dist/xxx.js" type="text/javascript">
```

## Examples
If you've installed dev dependencies you can `npm run dev` and go to `http://localhost:8080` to see them in action, else you'll have to check out the [code](examples).

