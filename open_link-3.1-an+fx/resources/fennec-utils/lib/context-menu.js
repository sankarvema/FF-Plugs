/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const { Class } = require('sdk/core/heritage');
const { EventTarget } = require('sdk/event/target');
const contextmenuNS = require('sdk/core/namespace').ns();
const winUtils = require('window-utils');
const { unload } = require('vold-utils/unload+');

const Item = Class({
  extends: EventTarget,
  initialize: function(options) {
    EventTarget.prototype.initialize.call(this, options);

    let onClick = options.onClick;

    // create tracker
    contextmenuNS(this).tracker = {
      onTrack: function(window) {
        let menuid = window.NativeWindow.contextmenus.add(options.label, {
          matches: options.context.isCurrent.bind(window)
        }, onClick);
        unload(function() {
          window.NativeWindow.contextmenus.remove(menuid);
        });
      }
    };

    // use tracker
    winUtils.WindowTracker(contextmenuNS(this).tracker);
  },
  
});
exports.Item = Item;

function LinkContext() {
  return {
    isCurrent: function(ele) {
      return this.NativeWindow.contextmenus.linkOpenableContext.matches(ele);
    }
  };
};
exports.LinkContext = LinkContext;
