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
 * Portions created by the Initial Developer are Copyright (C) 2008-2009
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

var urlflipperSettings =
{
	_VK_ACCEL: "",
	_VK_SHIFT: "",
	_VK_CONTROL: "",
	_VK_ALT: "",
	_VK_META: "",
	_MODIFIER_SEPARATOR: "",
	_keyMap: null,

	load: function( )
	{
		// Load key names
		const platformKeys = document.getElementById("platformKeys");
		this._VK_SHIFT = platformKeys.getString("VK_SHIFT");
		this._VK_CONTROL = platformKeys.getString("VK_CONTROL");
		this._VK_ALT = platformKeys.getString("VK_ALT");
		this._VK_META = platformKeys.getString("VK_META");
		this._MODIFIER_SEPARATOR = platformKeys.getString("MODIFIER_SEPARATOR");

		var mgr = Components.classes["@code.kliu.org/urlflipper/manager;2"].
		          getService().wrappedJSObject;

		switch (mgr.accel)
		{
			case KeyEvent.DOM_VK_CONTROL:
				this._VK_ACCEL = this._VK_CONTROL;
				break;
			case KeyEvent.DOM_VK_ALT:
				this._VK_ACCEL = this._VK_ALT;
				break;
			case KeyEvent.DOM_VK_META:
				this._VK_ACCEL = this._VK_META;
				break;
			default:
				this._VK_ACCEL = "Accel";
		}

		// Create a mapping of map integer key codes to their string names
		this._keyMap = new Array();
		this._keyMap[KeyEvent.DOM_VK_PAGE_UP]   = "VK_PAGE_UP";
		this._keyMap[KeyEvent.DOM_VK_PAGE_DOWN] = "VK_PAGE_DOWN";
		this._keyMap[KeyEvent.DOM_VK_END]       = "VK_END";
		this._keyMap[KeyEvent.DOM_VK_HOME]      = "VK_HOME";
		this._keyMap[KeyEvent.DOM_VK_LEFT]      = "VK_LEFT";
		this._keyMap[KeyEvent.DOM_VK_UP]        = "VK_UP";
		this._keyMap[KeyEvent.DOM_VK_RIGHT]     = "VK_RIGHT";
		this._keyMap[KeyEvent.DOM_VK_DOWN]      = "VK_DOWN";

		this._updateDisplay("decr");
		this._updateDisplay("incr");
		this._updateDisplay("qdecr");
		this._updateDisplay("qincr");
		this._updateDisplay("clear");
	},

	handle: function( name, event )
	{
		var isDirKey = event.keyCode >= KeyEvent.DOM_VK_PAGE_UP && event.keyCode <= KeyEvent.DOM_VK_DOWN;
		var isFunKey = event.keyCode >= KeyEvent.DOM_VK_F1 && event.keyCode <= KeyEvent.DOM_VK_F24;
		var hasMod1 = event.ctrlKey || event.altKey || event.metaKey;
		var hasMod2 = hasMod1 || event.shiftKey;

		if ((event.charCode && hasMod1) || (isDirKey && hasMod2) || isFunKey)
		{
			var modifiers = "";
			if (event.ctrlKey) modifiers += "control,";
			if (event.metaKey) modifiers += "meta,";
			if (event.shiftKey) modifiers += "shift,";
			if (event.altKey) modifiers += "alt,";

			const modifiersCtrl = document.getElementById(name + "-modifiersCtrl");
			modifiersCtrl.value = modifiers.replace(/,$/, "");
			modifiersCtrl.doCommand();

			const keyCtrl = document.getElementById(name + "-keyCtrl");

			if (event.charCode)
				keyCtrl.value = String.fromCharCode(event.charCode).toUpperCase();
			else if (isFunKey)
				keyCtrl.value = "VK_F" + (event.keyCode - KeyEvent.DOM_VK_F1 + 1).toString();
			else
				keyCtrl.value = this._keyMap[event.keyCode];

			keyCtrl.doCommand();

			event.preventDefault();
			this._updateDisplay(name);
		}
	},

	_updateDisplay: function( name )
	{
		var modName = document.getElementById(name + "-modifiersCtrl").value
			.replace(/[\s,]+/g, this._MODIFIER_SEPARATOR)
			.replace(/\baccel\b/, this._VK_ACCEL)
			.replace(/\bshift\b/, this._VK_SHIFT)
			.replace(/\bcontrol\b/, this._VK_CONTROL)
			.replace(/\balt\b/, this._VK_ALT)
			.replace(/\bmeta\b/, this._VK_META);

		if (modName)
			modName += this._MODIFIER_SEPARATOR;

		var keyName = document.getElementById(name + "-keyCtrl").value;

		if (/^VK_/.test(keyName))
			keyName = document.getElementById("globalKeys").getString(keyName);

		document.getElementById(name + "Ctrl").value = modName + keyName;
	}
};
