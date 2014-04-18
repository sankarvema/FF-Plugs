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

var urlflipperDialog =
{
	// Controls
	_urlField: null,
	_varySegment: null,
	_dataType: null,
	_stripZeros: null,
	_interval: null,
	_skipCount: null,
	_accept: null,

	// Context
	_ctx: null,
	_width: 0,

	// RegExp
	_re: {  // [ 0-legality    , 1-width      , 2-autosel   ]
		dec:   [ /^\d+$/       , /\d+$/       , /\d+/g      ],
		oct:   [ /^[0-7]+$/    , /[0-7]+$/    , /[0-7]+/g   ],
		uhex:  [ /^[\dA-F]+$/  , /[\dA-F]+$/i , /[\dA-F]+/g ],
		lhex:  [ /^[\da-f]+$/  , /[\da-f]+$/i , /[\da-f]+/g ],
		alpha: [ /^[\dA-Z]+$/i , /[\dA-Z]+$/i , /\d+/g      ]
	},

	// Shortcuts
	get _url( )      { return(this._urlField.value); },
	get _urlStart( ) { return(this._urlField.selectionStart); },
	get _urlEnd( )   { return(this._urlField.selectionEnd); },

	_lastMatch: function( regexp, str )
	{
		var result, temp;

		while (temp = regexp.exec(str))
			result = temp;

		return(result);
	},

	load: function( )
	{
		with (this)
		{
			_urlField = document.getElementById("urlField");
			_varySegment = document.getElementById("varySegment");
			_dataType = document.getElementById("dataType");
			_stripZeros = document.getElementById("stripZeros");
			_interval = document.getElementById("interval");
			_skipCount = document.getElementById("skipCount");
			_accept = document.documentElement.getButton("accept");

			_ctx = window.arguments[0];

			_urlField.value = _ctx.url;
			_dataType.value = _ctx.type;
			_stripZeros.checked = _ctx.width == 0;
			_interval.value = _ctx.interval;
			_skipCount.value = _ctx.skipCount;
		}

		// Take the focus away from urlField or else it will screw up auto-select
		this._dataType.focus();

		if (this._ctx.presel)
		{
			this._urlField.setSelectionRange(this._ctx.start, this._ctx.end);

			var type = null;
			var sel = this._url.substring(this._urlStart, this._urlEnd);

			// The search order to determine which type to use
			var search = [
				this._dataType.value,
				"dec", "uhex", "lhex", "alpha"
			];

			// Determine which (if any) type is appropriate
			for (var i = 0; i < search.length; ++i)
			{
				if (this._re[search[i]][0].test(sel))
				{
					type = search[i];
					break;
				}
			}

			// Use auto-accept if an appropriate type was found
			if (type)
			{
				this._dataType.value = type;
				this._ctx.auto = true;
			}
		}
		else
		{
			// Strip away the parts of the URL that we do not want to auto-select
			var url = this._url.replace(/^(?:f|ht)tps?:\/\/[^\/]+\//i, "")
			                   .replace(/%[\dA-F]{2}/gi, "===");

			// Search for pattern and select it if found
			var autoSelect = this._lastMatch(this._re[this._dataType.value][2], url);
			if (autoSelect)
			{
				var start = autoSelect.index + this._url.length - url.length;
				var end = start + autoSelect[0].length;
				this._urlField.setSelectionRange(start, end);
			}
		}

		this.update();

		// If the part of the URL to vary already contains a leading zero, then
		// it makes sense to override and make _stripZeros unchecked by default.
		if (this._varySegment.value.match(/^0/))
			this._stripZeros.checked = false;

		// Auto-accept?
		if (this._ctx.auto && this._ctx.canAuto && this._accept.getAttribute("disabled") != "true")
			this._accept.click();
	},

	accept: function( )
	{
		with (this)
		{
			_ctx.ok = true;
			_ctx.pre = _urlStart;
			_ctx.post = _url.length - _urlEnd;

			_ctx.type = _dataType.value;
			_ctx.width = (_stripZeros.checked) ? 0 : _width;
			_ctx.interval = parseInt(_interval.value);
			_ctx.skipCount = parseInt(_skipCount.value);
		}
	},

	update: function( )
	{
		with (this)
		{
			_varySegment.value = (_url.length > _urlEnd - _urlStart) ?
				_url.substring(_urlStart, _urlEnd) : "";

			// Update the width setting
			var result = _re[_dataType.value][1].exec(_varySegment.value);
			if (result)
				_width = result[0].length;
			else
				_width = 0;

			// Disable interval in alpha mode
			if (_dataType.value != "alpha")
				_interval.removeAttribute("disabled");
			else
				_interval.setAttribute("disabled", "true");

			// Check validity
			if (_width && (_dataType.value == "alpha" || parseInt(_interval.value) > 0) && parseInt(_skipCount.value) >= 0)
				_accept.removeAttribute("disabled");
			else
				_accept.setAttribute("disabled", "true");
		}
	}
};
