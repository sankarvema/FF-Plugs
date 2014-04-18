/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is URL Flipper.
 *
 * The Initial Developer of the Original Code is Kai Liu.
 * Portions created by the Initial Developer are Copyright (C) 2009-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Kai Liu <kliu@code.kliu.org>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


var UrlFlipperManager =
{

/** Public ********************************************************************/


	// Pref wrappers
	ps: Components.classes["@mozilla.org/preferences-service;1"].
	    getService(Components.interfaces.nsIPrefService),

	get accel( ) { return(this.ps.getBranch("ui.key.").getIntPref("accelKey")); },


	/**
	 * init - must be called before any other function is called
	 * @return: default options object
	 */
	init: function( )
	{
		this._init();
		return(this._copy(this._default, true));
	},


	/**
	 * getSchema
	 * @param url: base URL, as a decoded string
	 * @return: schema object if successful, null otherwise
	 */
	getSchema: function( url )
	{
		for each (var schema in this._schemas)
		{
			if ( url.length > (schema.pre + schema.post) &&
			     this._makeKey(url, schema.pre, schema.post) == schema.key )
			{
				return(this._copy(schema));
			}
		}

		return(null);
	},


	/**
	 * setSchema
	 * @param schema: schema object
	 * @return: ID key
	 */
	setSchema: function( schema )
	{
		var newSchema = this._copy(schema);

		if ("url" in schema)
			newSchema.key = this._makeKey(schema.url, schema.pre, schema.post);

		if ("key" in newSchema && newSchema.key.length)
		{
			this._schemas[newSchema.key] = newSchema;
			this._default = this._copy(newSchema, true);
			this._save(false);
			return(newSchema.key);
		}

		return(null);
	},


	/**
	 * updateSchema
	 * @param schema: schema object
	 * @return: N/A
	 */
	updateSchema: function( schema )
	{
		if (schema.key in this._schemas)
		{
			/* There is only one user of updateSchema, and it only updates width
			this._schemas[schema.key].type = schema.type;
			this._schemas[schema.key].interval = schema.interval;
			this._schemas[schema.key].skipCount = schema.skipCount;
			 */
			this._schemas[schema.key].width = schema.width;
			this._save(false);
		}
	},


	/**
	 * deleteSchema
	 * @param key: valid ID key
	 * @return: N/A
	 */
	deleteSchema: function( key )
	{
		delete this._schemas[key];
		this._save(false);
	},


	/**
	 * nuke
	 * @return: N/A
	 */
	nuke: function( )
	{
		with (this)
		{
			_schemasPublic = { };
			_schemasPrivate = { };
			_schemas = (_privateMode) ? _schemasPrivate : _schemasPublic;
			_save(true);
		}
	},


/** End Public ****************************************************************/



/** XPCOM *********************************************************************/


	// XPConnect wrapping
	get wrappedJSObject( ) { return(this); },


	// nsISupports members
	QueryInterface: function( iid )
	{
		if ( iid.equals(Components.interfaces.nsIObserver) ||
		     iid.equals(Components.interfaces.nsIFactory) ||
		     iid.equals(Components.interfaces.nsISupports) )
		{
			return(this);
		}

		throw(Components.results.NS_ERROR_NO_INTERFACE);
	},


	// nsIFactory members
	createInstance: function( outer, iid )
	{
		if (outer == null)
			return(this.QueryInterface(iid));

		throw(Components.results.NS_ERROR_NO_AGGREGATION);
	},

	lockFactory: function( lock )
	{
		throw(Components.results.NS_ERROR_NOT_IMPLEMENTED);
	},


	// nsIObserver members
	observe: function( aSubject, aTopic, aData )
	{
		if (aTopic == "private-browsing")
		{
			if (aData == "enter")
				this._enterPrivate();
			else if (aData == "exit")
				this._exitPrivate();
		}
		else if (aTopic == "quit-application")
		{
			this._os.removeObserver(this, "quit-application");
			this._os.removeObserver(this, "private-browsing");
		}
	},


/** End XPCOM *****************************************************************/



/** Private *******************************************************************/


	// Service wrappers
	_os:  Components.classes["@mozilla.org/observer-service;1"].
	      getService(Components.interfaces.nsIObserverService),


	// Enter private browsing mode
	_enterPrivate: function( )
	{
		this._privateMode = true;
		this._schemasPrivate = eval(uneval(this._schemasPublic));
		this._schemas = this._schemasPrivate;
	},


	// Exit private browsing mode
	_exitPrivate: function( )
	{
		this._privateMode = false;
		this._schemasPrivate = { };
		this._schemas = this._schemasPublic;
	},


	// Clone a schema object
	_copy: function( schema, copyOptionsOnly )
	{
		var clone = { };

		const copy = function( name, i, fields ) {
			clone[name] = schema[name];
		};

		if (!copyOptionsOnly)
			[ "key", "pre", "post" ].forEach(copy);

		[ "type", "width", "interval", "skipCount" ].forEach(copy);

		return(clone);
	},


	// Get the hash of a string, encoded in Base64
	_hashBase64: function( str )
	{
		const ScriptableUnicodeConverter = Components.Constructor(
			"@mozilla.org/intl/scriptableunicodeconverter",
			"nsIScriptableUnicodeConverter"
		);

		const CryptoHash = Components.Constructor(
			"@mozilla.org/security/hash;1",
			"nsICryptoHash",
			"initWithString"
		);

		var unicon = new ScriptableUnicodeConverter();
		unicon.charset = "UTF-8";
		var raw = unicon.convertToByteArray(str, { });

		var hasher = new CryptoHash("sha1");
		hasher.update(raw, raw.length);
		return(hasher.finish(true));
	},


	// Generate a unique key from the URL identifying parameters of the schema
	_makeKey: function( url, pre, post )
	{
		return(this._hashBase64(
			url.substr(0, pre) + "\u0000" +
			url.substr(url.length - post) + "\u0000" +
			url.match(/[^\dA-Z]/gi).length
		));
	},


	// Save the current schema set to disk
	// * To protect against profile snooping, hashes are saved instead of URLs
	// * nsIJSON is required for saving/loading, so it is disabled for Fx2
	_save: function( forceSave )
	{
		if (!(this._JSON))
			return;

		if (this._privateMode && !forceSave)
			return;

		const FileOutputStream = Components.Constructor(
			"@mozilla.org/network/file-output-stream;1",
			"nsIFileOutputStream",
			"init"
		);

		const ConverterOutputStream = Components.Constructor(
			"@mozilla.org/intl/converter-output-stream;1",
			"nsIConverterOutputStream",
			"init"
		);

		try {
			var fstream = new FileOutputStream(this._file, -1, -1, 0);
			var cstream = new ConverterOutputStream(fstream, "UTF-8", 0x1000, 0);

			// Unfortunately, encodeToStream seems to be broken...
			var obj = { def: this._default, schemas: this._schemasPublic };
			cstream.writeString(this._JSON.encode(obj));
			cstream.close();
		} catch (e) { }
	},


	// Load the schema from disk
	_load: function( )
	{
		if (!(this._JSON && this._file.exists()))
			return;

		const FileInputStream = Components.Constructor(
			"@mozilla.org/network/file-input-stream;1",
			"nsIFileInputStream",
			"init"
		);

		try {
			var fstream = new FileInputStream(this._file, -1, -1, 0);

			var obj = this._JSON.decodeFromStream(fstream, fstream.available());
			fstream.close();

			if ("def" in obj && "schemas" in obj)
			{
				this._default = obj.def;
				this._schemasPublic = obj.schemas;
			}
		} catch (e) { }
	},


	// Initialization
	_hasInit: false,
	_JSON: null,
	_file: null,
	_schemasPublic: { },
	_default: { type: "dec", width: 1, interval: 1, skipCount: 0 },

	_init: function( )
	{
		if (this._hasInit) return;

		this._hasInit = true;

		try {
			this._JSON = Components.classes["@mozilla.org/dom/json;1"].
			             createInstance(Components.interfaces.nsIJSON);
		} catch (e) { }

		if (this._JSON)
		{
			this._file = Components.classes["@mozilla.org/file/directory_service;1"].
			             getService(Components.interfaces.nsIProperties).
			             get("ProfD", Components.interfaces.nsIFile).
			             clone();

			this._file.append("urlflipper.json");
			this._load();
		}

		// This initializes the schemas and states for private browsing
		this._exitPrivate();

		try {
			// Try getting the service first, so that if it fails, we don't
			// waste effort setting up observers
			const pbs = Components.classes["@mozilla.org/privatebrowsing;1"].
			            getService(Components.interfaces.nsIPrivateBrowsingService);

			if (pbs.privateBrowsingEnabled)
				this._enterPrivate();

			this._os.addObserver(this, "private-browsing", false);
			this._os.addObserver(this, "quit-application", false);
		} catch (e) { }
	}


/** End Private ***************************************************************/

};


var UrlFlipperManagerModule =
{
	// Private members
	_CLASS_ID: Components.ID("{15f8a3d8-4c0f-4cd7-938c-5609113b66e4}"),
	_CLASS_NAME: "URL Flipper Manager",
	_CONTRACT_ID: "@code.kliu.org/urlflipper/manager;2",
	_ICR: Components.interfaces.nsIComponentRegistrar,
	_registered: false,


	// nsISupports members
	QueryInterface: function( iid )
	{
		if ( iid.equals(Components.interfaces.nsIModule) ||
		     iid.equals(Components.interfaces.nsISupports) )
		{
			return(this);
		}

		throw(Components.results.NS_ERROR_NO_INTERFACE);
	},


	// nsIModule members
	getClassObject: function( compMgr, cid, iid )
	{
		if (cid.equals(this._CLASS_ID))
			return(UrlFlipperManager.QueryInterface(iid));

		throw(Components.results.NS_ERROR_NO_INTERFACE);
	},

	registerSelf: function( compMgr, location, loaderStr, type )
	{
		compMgr = compMgr.QueryInterface(this._ICR);

		if (!this._registered && !compMgr.isCIDRegistered(this._CLASS_ID))
		{
			this._registered = true;

			// Register component
			compMgr.registerFactoryLocation(
				this._CLASS_ID,
				this._CLASS_NAME,
				this._CONTRACT_ID,
				location,
				loaderStr,
				type
			);
		}
	},

	unregisterSelf: function( compMgr, location, loaderStr )
	{
		compMgr = compMgr.QueryInterface(this._ICR);

		if (this._registered)
		{
			this._registered = false;

			// Unregister component
			compMgr.unregisterFactoryLocation(
				this._CLASS_ID,
				location
			);
		}
	},

	canUnload: function( compMgr ) { return(true); }
};


function NSGetModule( compMgr, location )
{
	return(UrlFlipperManagerModule);
}


function NSGetFactory( cid )
{
	if (cid.equals(UrlFlipperManagerModule._CLASS_ID))
		return(UrlFlipperManager);
	else
		throw(Components.results.NS_ERROR_FACTORY_NOT_REGISTERED);
}
