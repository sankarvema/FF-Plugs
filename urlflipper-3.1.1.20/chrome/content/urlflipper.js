/* ***** INTEGRATION NOTES *****
 * For people who want to invoke URL Flipper from other extensions (e.g., a
 * mouse gesture extension), the following parameterless functions are provided:
 *
 * UrlFlipperDec()
 * UrlFlipperInc()
 * UrlFlipperClear()
 */


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
 * Portions created by the Initial Developer are Copyright (C) 2006-2011
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
	Components.classes["@code.kliu.org/urlflipper/manager;2"].
	getService().wrappedJSObject;

var NoRedirectService_UF =
	Components.classes["@code.kliu.org/noredirect;5"].
	getService().wrappedJSObject;


/*******************************************************************************
 *
 * Main extension object and public functions
 *
 ******************************************************************************/


var UrlFlipper =
{
	_mgr: UrlFlipperManager,
	_ctx: UrlFlipperManager.init(),

	// Handle toolbar modifiers
	click: function( aIncrement, event )
	{
		event.accelKey = (this._mgr.accel == KeyEvent.DOM_VK_META) ?
			event.metaKey :
			event.ctrlKey;

		this.adjust(
			aIncrement,
			event.altKey,     // auto
			event.shiftKey,   // forceDlg
			event.accelKey,   // useOrigin
			event.button == 1 // newTab
		);
	},

	// Increment/decrement the current URL
	adjust: function( aIncrement, auto, forceDlg, useOrigin, newTab )
	{
		var urlctx = this._getUrlCtx();

		// Has the user pre-selected the URL?

		var start = gURLBar.selectionStart;
		var end = gURLBar.selectionEnd;

		if ( end - start > 0 &&
		     end - start < urlctx.base.length &&
		     end <= urlctx.base.length &&
		     gURLBar.value == urlctx.full )
		{
			this._bypass(urlctx);
			this._ctx.presel = true;
			this._ctx.start = start;
			this._ctx.end = end;
			gURLBar.select();
		}
		else
		{
			if (forceDlg) this._bypass(urlctx);
			this._ctx.presel = false;
		}

		// If the URL is covered by an existing pattern, perform the adjustment

		if (urlctx.schema)
		{
			var curIndex = urlctx.base.substr(
				urlctx.schema.pre,
				urlctx.base.length - (urlctx.schema.pre + urlctx.schema.post)
			);

			// Retrieve the origin (and set it if it is unset)
			var oldIndex = this._origin(urlctx.schema.key, curIndex, urlctx.browser);

			// Determine which index to decrement or increment from
			var srcIndex = (useOrigin) ? oldIndex : curIndex;

			// Intelligently update the desired width
			if ( (srcIndex.length > 0 && srcIndex.length != urlctx.schema.width) &&
			     (srcIndex.match(/^0/) || srcIndex.length < urlctx.schema.width) )
			{
				urlctx.schema.width = srcIndex.length;
				this._mgr.updateSchema(urlctx.schema);
			}

			var newIndex = this._adjust(
				srcIndex,
				aIncrement,
				urlctx.schema
			);

			if (newIndex.length)
			{
				urlctx.index = newIndex;
				urlctx.increment = aIncrement;

				if (newTab)
				{
					var tab = gBrowser.addTab();
					urlctx.browser = tab.linkedBrowser;

					// Set the origin of the new tab to that of the old tab
					this._origin(urlctx.schema.key, oldIndex, urlctx.browser);

					if (!getBoolPref("browser.tabs.loadInBackground"))
						gBrowser.selectedTab = tab;
				}

				if (urlctx.browser.getAttribute("urlflipper_active") == "true")
					return;

				var loader = new UrlFlipperLoader(urlctx);
				loader.load();
			}

			return;
		}

		// The current URL is not covered by one of our known patterns, so pop
		// up the dialog.

		this._ctx.ok = false;
		this._ctx.url = urlctx.base;
		this._ctx.auto = auto;
		this._ctx.canAuto = !forceDlg;

		openDialog("chrome://urlflipper/content/urlflipper.dialog.xul",
		           "", "chrome,modal=yes", this._ctx);

		if (this._ctx.ok && (this._ctx.key = this._mgr.setSchema(this._ctx)))
		{
			// Reset the origin
			this._origin(this._ctx.key, null, urlctx.browser);

			// Try again with the new schema
			this.onLocationChange(null, null, null);
			this.adjust(aIncrement, false, false, useOrigin, newTab);
		}
	},

	// Clear the current URL pattern
	clear: function( )
	{
		var urlctx = this._getUrlCtx();

		if (urlctx.schema)
		{
			this._mgr.deleteSchema(urlctx.schema.key);
			this.onLocationChange(null, null, null);
		}
	},

	// Nuke all data
	nuke: function( )
	{
		this._mgr.nuke();
		this.onLocationChange(null, null, null);
	},

	// Converts the current URL into a usable form
	_getUrlCtx: function( )
	{
		// The same as decodeURI, except that %25 will not be translated into %
		function decode( str ) {
			try {
				return(decodeURI(str.replace(/%25/g, "\x00")).replace(/\x00/g, "%25"));
			} catch (e) {
				return(str);
			}
		}

		var urlctx = { browser: gBrowser.selectedBrowser };
		urlctx.full = decode(urlctx.browser.currentURI.spec);

		// Separate the anchor (if there is one) from the rest of the URL
		var anchorIdx = (urlctx.full + "#").indexOf("#");
		urlctx.base = urlctx.full.substr(0, anchorIdx);

		if (urlctx.schema = this._mgr.getSchema(urlctx.base))
		{
			urlctx.head = urlctx.full.substr(0, urlctx.schema.pre);
			urlctx.tail = urlctx.full.substr(anchorIdx - urlctx.schema.post);
		}

		return(urlctx);
	},

	// Bypasses a schema
	_bypass: function( urlctx )
	{
		if (urlctx.schema)
		{
			this._ctx = urlctx.schema;
			this._mgr.deleteSchema(urlctx.schema.key);
			this.onLocationChange(null, null, null);
			urlctx.schema = null;
		}
	},

	// Gets, sets, or deletes origin data; this is a per-tab setting
	_origin: function( rawKey, index, browser )
	{
		var key = "UF_" + rawKey;

		if (index == null)
			delete browser[key];
		else if (!(key in browser))
			browser[key] = index;

		return(browser[key]);
	},

	// Increment/decrement a string
	_adjust: function( aString, aIncrement, options )
	{
		var newString = "";

		// The easy case: dec/oct/hex can be handled by regexp

		if (options.type != "alpha")
		{
			var regexp;
			var base;

			switch (options.type)
			{
				case "oct":
					regexp = /^(.*?)([0-7]+)$/;
					base = 8;
					break;
				case "uhex":
				case "lhex":
					regexp = /^(.*?)([\dA-F]+)$/i;
					base = 16;
					break;
				default:
					regexp = /^(.*?)(\d+)$/;
					base = 10;
			}

			newString = aString.replace(regexp, function( str, p1, p2, offset, s )
			{
				var value = parseInt(p2, base);
				value += aIncrement ? options.interval : -options.interval;
				if (value < 0) value = 0;

				var valueString = value.toString(base);

				if (options.type == "uhex")
					valueString = valueString.toUpperCase();
				else if (options.type == "lhex")
					valueString = valueString.toLowerCase();

				// Zero-padding
				var numOfZeros = options.width - valueString.length;
				for (var i = 0; i < numOfZeros; ++i)
					valueString = '0' + valueString;

				return(p1 + valueString);
			});

			return((aString != newString) ? newString : "");
		}

		// The harder case: alphanumeric requires manual processing

		var overflow = true;

		for (var i = aString.length - 1; i >= -1 ; --i)
		{
			if (!overflow)
			{
				// We're done if there's nothing left to change
				newString = aString.substr(0, i + 1) + newString;
				break;
			}
			else if ( i < 0 || (
			          (aString[i] < '0' || aString[i] > '9') &&
			          (aString[i] < 'A' || aString[i] > 'Z') &&
			          (aString[i] < 'a' || aString[i] > 'z') ) )
			{
				// We've hit the end, either because we're past the start of the string
				// or we've gone past the substring of mutable characters... AND, the
				// overflow flag's still set, meaning that there're still things to change!

				if (aIncrement && newString.length > 0 && newString[0] == '0')
				{
					// When incrementing numbers and we get 9->10, we add a leading byte
					newString = aString.substr(0, i + 1) + '1' + newString;
					break;
				}
				else
				{
					// In all other cases, we bug out!
					return("");
				}
			}
			else
			{
				// Both the index and the character range are within bounds

				var charCode = aString.charCodeAt(i);
				aIncrement ? ++charCode : --charCode;

				// Detect & handle overflows

				overflow = true;
				if (charCode == 0x2F)
					charCode = 0x39;
				else if (charCode == 0x3A)
					charCode = 0x30;
				else if (charCode == 0x40)
					charCode = 0x5A;
				else if (charCode == 0x5B)
					charCode = 0x41;
				else if (charCode == 0x60)
					charCode = 0x7A;
				else if (charCode == 0x7B)
					charCode = 0x61;
				else
					overflow = false;

				newString = String.fromCharCode(charCode) + newString;
			}
		}

		if (options.width == 0)
			newString = newString.replace(/^(.*[^\dA-Z])?0+([\dA-Z]+?)$/i, "$1$2");

		return(newString);
	},


	// A progress listener to disable/enable the Clear Pattern button

	// nsISupports members
	QueryInterface: function( iid )
	{
		if ( iid.equals(Components.interfaces.nsIWebProgressListener) ||
		     iid.equals(Components.interfaces.nsISupportsWeakReference) ||
		     iid.equals(Components.interfaces.nsISupports) )
		{
			return(this);
		}

		throw(Components.results.NS_ERROR_NO_INTERFACE);
	},

	// nsIWebProgressListener members
	onStateChange: function( a, b, c, d ) { },
	onProgressChange: function( a, b, c, d, e, f ) { },

	onLocationChange: function( aWebProgress, aRequest, aLocation )
	{
		var urlctx = this._getUrlCtx();

		document.getElementById("cmd_urlflipperClear")
		        .setAttribute("disabled", (urlctx.schema) ? "false" : "true");
	},

	onStatusChange: function( a, b, c, d ) { },
	onSecurityChange: function( a, b, c ) { }
};

function UrlFlipperDec( ) { UrlFlipper.adjust(false); }
function UrlFlipperInc( ) { UrlFlipper.adjust(true); }
function UrlFlipperClear( ) { UrlFlipper.clear(); }


/*******************************************************************************
 *
 * URL loader; will attempt to skip past bad URLs
 *
 ******************************************************************************/


function UrlFlipperLoader( context ) { this._ctx = context; }
UrlFlipperLoader.prototype =
{
	// nsISupports members
	QueryInterface: function( iid )
	{
		if ( iid.equals(Components.interfaces.nsIStreamListener) ||
		     iid.equals(Components.interfaces.nsIRequestObserver) ||
		     iid.equals(Components.interfaces.nsIWebProgressListener) ||
		     iid.equals(Components.interfaces.nsISupportsWeakReference) ||
		     iid.equals(Components.interfaces.nsISupports) )
		{
			return(this);
		}

		throw(Components.results.NS_ERROR_NO_INTERFACE);
	},


	// nsIRequestObserver members
	onStartRequest: function( aRequest, aContext )
	{
		if (this._tab)
		{
			this._ctx.browser.setAttribute("urlflipper_active", "true");

			// Update status bar
			this._ctx.browser.contentWindow.status = decodeURI(aRequest.name);

			// Set the tab's throbber
			this._tab.setAttribute("busy", "true");
			this._tab.removeAttribute("image");

			// Set the window's throbber
			var throbber = document.getElementById("navigator-throbber");
			if (throbber && this._tab == gBrowser.selectedTab)
				throbber.setAttribute("busy", "true");
		}
	},

	onStopRequest: function( aRequest, aContext, aStatusCode )
	{
		if (!this._valid) return(this._cleanup());

		var code = 0;

		try {
			code = aRequest.
			       QueryInterface(Components.interfaces.nsIHttpChannel).
			       responseStatus;
		} catch (e) { }

		if ( code == 301 || code == 302 || code == 303 ||
		     code == 403 || code == 404 || code == 410 )
		{
			this._ctx.index = UrlFlipper._adjust(
				this._ctx.index,
				this._ctx.increment,
				this._ctx.schema
			);

			if (this._ctx.index.length)
			{
				this.load();
				return;
			}
		}

		this._loadInBrowser();
	},


	// nsIStreamListener members
	onDataAvailable: function( aRequest, aContext, aInputStream, aOffset, aCount )
	{
		aRequest.cancel(0x804B0002); // NS_BINDING_ABORTED
	},


	// nsIWebProgressListener members
	onStateChange: function( aWebProgress, aRequest, aStateFlags, aStatus )
	{
		// Avoid being tripped up by the initialization of a new tab
		if (aRequest && aRequest.name == "about:blank") return;

		if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
		{
			const NRS = NoRedirectService_UF;
			NRS.stopRefresh(aWebProgress);

			var doc = null;

			try {
				doc = aWebProgress.DOMWindow.document.
				      QueryInterface(Components.interfaces.nsIDOMHTMLDocument);
			} catch (e) { }

			var status = NRS.readStatus(aRequest);

			if (status.mode == 1)
			{
				NRS.insertNotice(doc, status.code, status.dest);
			}
			else if (doc)
			{
				var docURI = NRS.makeURI(doc.URL, null);
				var refURI = NRS.getRefreshURI(doc, aRequest);

				if (refURI && NRS.compareURIs(docURI, refURI))
					NRS.insertNotice(doc, "Refresh", refURI.spec);
			}

			aWebProgress.removeProgressListener(this);
		}
	},

	onProgressChange: function( a, b, c, d, e, f ) { },
	onLocationChange: function( a, b, c ) { },
	onStatusChange: function( a, b, c, d ) { },
	onSecurityChange: function( a, b, c ) { },


	// Is our tab still valid/unclosed?
	get _valid( ) { return(this._ctx.browser && this._ctx.browser.contentWindow); },

	// Find the tab associated with the browser
	get _tab( )
	{
		if (!this._valid) return(null);

		if (!("tab" in this._ctx))
		{
			this._ctx.tab = null;

			for (var i = 0; i < gBrowser.mTabs.length; ++i)
			{
				if (gBrowser.mTabs[i].linkedBrowser == this._ctx.browser)
				{
					this._ctx.tab = gBrowser.mTabs[i];
					break;
				}
			}
		}

		return(this._ctx.tab);
	},


	// Attempt a load
	load: function( )
	{
		this._ctx.url = this._ctx.head + this._ctx.index + this._ctx.tail;

		if (this._ctx.schema.skipCount--)
		{
			try {
				chan = Components.classes["@mozilla.org/network/io-service;1"].
				       getService(Components.interfaces.nsIIOService).
				       newChannel(this._ctx.url, null, null).
				       QueryInterface(Components.interfaces.nsIHttpChannel);

				chan.requestMethod = "HEAD";
				chan.redirectionLimit = 0;
				chan.asyncOpen(this, null);
				return;
			} catch (e) { }
		}

		this._loadInBrowser();
	},


	// Actual, final load
	_loadInBrowser: function( )
	{
		const HeaderStream = Components.Constructor(
			"@mozilla.org/io/string-input-stream;1",
			"nsIStringInputStream",
			"setData"
		);

		this._ctx.browser.webProgress.addProgressListener(
			this,
			Components.interfaces.nsIWebProgress.NOTIFY_STATE_NETWORK
		);

		this._ctx.browser.webNavigation.loadURI(
			this._ctx.url,
			0,
			null,
			null,
			new HeaderStream("X-NoRedirect-Mode: 1\r\n", -1)
		);

		this._cleanup();
	},

	_cleanup: function( )
	{
		try {
			this._ctx.browser.removeAttribute("urlflipper_active");
		}
		finally {
			this._ctx = { };
		}
	}
}


/*******************************************************************************
 *
 * Initializer; loads shortcut keys and sets up a listener for the Clear button
 *
 ******************************************************************************/


var UrlFlipperInit =
{
	load: function( )
	{
		window.removeEventListener("load", UrlFlipperInit.load, false);
		NoRedirectService_UF.init();

		// Listen for location bar changes to disable/enable the Clear button
		gBrowser.addProgressListener(UrlFlipper);

		// Load key preferences

		const prefs = UrlFlipperManager.ps.getBranch("extensions.urlflipper.");
		var keyset = document.getElementById("mainKeyset");

		function setKey( id, prefix )
		{
			var keyCode = prefs.getCharPref(prefix + "-key")
			var keyType = (/^VK_/.test(keyCode)) ? "keycode" : "key";
			var key = document.createElement("key");
			key.id = "key_" + id;
			key.setAttribute(keyType, keyCode);
			key.setAttribute("modifiers", prefs.getCharPref(prefix + "-modifiers"));
			key.setAttribute("command", "cmd_" + id);
			keyset.appendChild(key);
		}

		setKey("urlflipperDecr", "decr");
		setKey("urlflipperIncr", "incr");
		setKey("urlflipperQDecr", "qdecr");
		setKey("urlflipperQIncr", "qincr");
		setKey("urlflipperClear", "clear");
		keyset = null;

		// Relocate the UF menu; the reason why UF does not directly overlay the
		// Tools menu is because SM and FF have different menu IDs, and it is
		// easier to overlay a common menu and move than to overlay two menus.

		const xai = Components.classes["@mozilla.org/xre/app-info;1"].
		            getService(Components.interfaces.nsIXULAppInfo);

		var menu = document.getElementById("menu_urlflipperMenu");

		if (xai.ID == "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}")
		{
			// SeaMonkey
			var anchor = document.getElementById("navBeginGlobalItems");

			if (menu && anchor)
			{
				menu.parentNode.removeChild(menu);
				anchor.parentNode.insertBefore(menu, anchor.nextSibling);
			}
		}
		else
		{
			// Firefox
			var anchor = document.getElementById("devToolsSeparator");

			if (menu && anchor)
			{
				menu.parentNode.removeChild(menu);
				anchor.parentNode.insertBefore(menu, anchor);
			}
		}

		if (document.getElementById("appmenu-popup"))
		{
			// For Firefox 4, make a copy of the UF menu for the app menu.
			var anchor = document.getElementById("appmenu_fullScreen");

			if (menu && anchor)
			{
				var newmenu = menu.cloneNode(true);
				anchor.parentNode.insertBefore(newmenu, anchor);

				var sep = document.createElement("menuseparator");
				sep.className = "appmenu-menuseparator";
				anchor.parentNode.insertBefore(sep, anchor);
			}
		}
	},

	unload: function( )
	{
		window.removeEventListener("unload", UrlFlipperInit.unload, false);
		NoRedirectService_UF.uninit();
		gBrowser.removeProgressListener(UrlFlipper);
	}
};

window.addEventListener("load", UrlFlipperInit.load, false);
window.addEventListener("unload", UrlFlipperInit.unload, false);
