/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

const tabs = require('tabs');
const { get: _ } = require('l10n');

if (require('xul-app').is('Fennec')) {
  let cm = require('fennec-utils/context-menu');
  cm.Item({
    label: _('openlink'),
    context: cm.LinkContext(),
    onClick: function(ele) onClick(ele.href)
  });
}
else {
  let contextMenu = require('context-menu');
  contextMenu.Item({
    label: _('openlink'),
    context: contextMenu.SelectorContext('a'),
    contentScript: 'self.on("click", function(node) self.postMessage(node.href));',
    onMessage: onClick
  });
}

function onClick(url) {
  let tab = tabs.activeTab;
alert(url);
  if (tab)
    tab.url = url;
  else
    tab.open(url);
}
