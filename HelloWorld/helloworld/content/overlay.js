var HelloWorld = {
  onLoad: function() {
    // initialization code
    this.initialized = true;
	

  },

  onMenuItemCommand: function() {
    window.open("chrome://helloworld/content/hello.xul", "", "chrome");
	alert("Hi");
	//LoadFile();
	
		var contextMenu = require("sdk/context-menu");
	 var menuItem = contextMenu.Item({
	  label: "Log Selection",
	  context: contextMenu.SelectionContext(),
	  contentScript: 'self.on("click", function () {' +
					 '  var text = window.getSelection().toString();' +
					 '  self.postMessage(text);' +
					 '});',
	  onMessage: function (selectionText) {
		console.log(selectionText);
	  }
	});
	alert("Load executed!!!");
  }
};

window.addEventListener("load", function(e) { HelloWorld.onLoad(e); }, false); 

function LoadFile()
{
var file = DirIO.get("ProfD"); // Will get you profile directory
file.append("extensions"); // extensions subfolder of profile directory
file.append("{1234567E-12D1-4AFD-9480-FD321BEBD20D}"); // subfolder of your extension (that's your extension ID) of extensions directory
// append another subfolder here if your stuff.xml isn't right in extension dir
file.append("stuff.xml");
var fileContents = FileIO.read(@"d:\temp\stuff.xml");
var domParser = new DOMParser();
var dom = domParser.parseFromString(fileContents, "text/xml");
// print the name of the root element or error message
alert(fileContents);
dump(dom.documentElement.nodeName == "parsererror" ? "error while parsing" : dom.documentElement.nodeName);
}
