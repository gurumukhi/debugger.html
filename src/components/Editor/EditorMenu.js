/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

import { PureComponent } from "react";
import { connect } from "react-redux";
import { showMenu } from "devtools-launchpad";
import { isOriginalId } from "devtools-source-map";

import { copyToTheClipboard } from "../../utils/clipboard";
import { findFunctionText } from "../../utils/function";
import { findClosestScope } from "../../utils/breakpoint/astBreakpointLocation";
import {
  getSourceLocationFromMouseEvent,
  toSourceLine
} from "../../utils/editor";
import { isPretty, getRawSourceURL } from "../../utils/source";
import {
  getContextMenu,
  getPrettySource,
  getSelectedLocation,
  getSelectedSource,
  getSymbols
} from "../../selectors";

import actions from "../../actions";

type Props = {
  setContextMenu: Function
};

function getMenuItems(
  event,
  {
    addExpression,
    editor,
    flashLineRange,
    getFunctionLocation,
    getFunctionText,
    hasPrettyPrint,
    jumpToMappedLocation,
    onGutterContextMenu,
    selectedLocation,
    selectedSource,
    showSource,
    toggleBlackBox
  }
) {
  // variables
  const hasSourceMap = !!selectedSource.get("sourceMapURL");
  const isOriginal = isOriginalId(selectedLocation.sourceId);
  const isPrettyPrinted = isPretty(selectedSource);
  const isPrettified = isPrettyPrinted || hasPrettyPrint;
  const isMapped = isOriginal || hasSourceMap;
  const { line } = editor.codeMirror.coordsChar({
    left: event.clientX,
    top: event.clientY
  });
  const selectionText = editor.codeMirror.getSelection().trim();
  const sourceLocation = getSourceLocationFromMouseEvent(
    editor,
    selectedLocation,
    event
  );
  const textSelected = editor.codeMirror.somethingSelected();

  // localizations
  const blackboxKey = L10N.getStr("sourceFooter.blackbox.accesskey");
  const blackboxLabel = L10N.getStr("sourceFooter.blackbox");
  const unblackboxLabel = L10N.getStr("sourceFooter.unblackbox");
  const toggleBlackBoxLabel = selectedSource.get("isBlackBoxed")
    ? unblackboxLabel
    : blackboxLabel;
  const copyFunctionKey = L10N.getStr("copyFunction.accesskey");
  const copyFunctionLabel = L10N.getStr("copyFunction.label");
  const copySourceKey = L10N.getStr("copySource.accesskey");
  const copySourceLabel = L10N.getStr("copySource");
  const copySourceUri2Key = L10N.getStr("copySourceUri2.accesskey");
  const copySourceUri2Label = L10N.getStr("copySourceUri2");
  const jumpToMappedLocKey = L10N.getStr(
    "editor.jumpToMappedLocation1.accesskey"
  );
  const jumpToMappedLocLabel = L10N.getFormatStr(
    "editor.jumpToMappedLocation1",
    isOriginal ? L10N.getStr("generated") : L10N.getStr("original")
  );
  const revealInTreeKey = L10N.getStr("sourceTabs.revealInTree.accesskey");
  const revealInTreeLabel = L10N.getStr("sourceTabs.revealInTree");
  const watchExpressionKey = L10N.getStr("expressions.accesskey");
  const watchExpressionLabel = L10N.getStr("expressions.label");

  // menu items
  const copySourceItem = {
    id: "node-menu-copy-source",
    label: copySourceLabel,
    accesskey: copySourceKey,
    disabled: selectionText.length === 0,
    click: () => copyToTheClipboard(selectionText)
  };

  const copySourceUri2Item = {
    id: "node-menu-copy-source-url",
    label: copySourceUri2Label,
    accesskey: copySourceUri2Key,
    disabled: false,
    click: () => copyToTheClipboard(getRawSourceURL(selectedSource.get("url")))
  };

  const sourceId = selectedSource.get("id");
  const sourceLine = toSourceLine(sourceId, line);

  const functionText = getFunctionText(sourceLine);
  const copyFunctionItem = {
    id: "node-menu-copy-function",
    label: copyFunctionLabel,
    accesskey: copyFunctionKey,
    disabled: !functionText,
    click: () => {
      const { location: { start, end } } = getFunctionLocation(sourceLine);
      flashLineRange({
        start: start.line,
        end: end.line,
        sourceId: selectedLocation.sourceId
      });
      return copyToTheClipboard(functionText);
    }
  };

  const jumpToMappedLocationItem = {
    id: "node-menu-jump",
    label: jumpToMappedLocLabel,
    accesskey: jumpToMappedLocKey,
    disabled: !isMapped && !isPrettified,
    click: () => jumpToMappedLocation(sourceLocation)
  };

  const showSourceMenuItem = {
    id: "node-menu-show-source",
    label: revealInTreeLabel,
    accesskey: revealInTreeKey,
    disabled: isPrettyPrinted,
    click: () => showSource(sourceId)
  };

  const blackBoxMenuItem = {
    id: "node-menu-blackbox",
    label: toggleBlackBoxLabel,
    accesskey: blackboxKey,
    disabled: isOriginal || isPrettyPrinted || hasSourceMap,
    click: () => toggleBlackBox(selectedSource.toJS())
  };

  const watchExpressionItem = {
    id: "node-menu-add-watch-expression",
    label: watchExpressionLabel,
    accesskey: watchExpressionKey,
    click: () => addExpression(editor.codeMirror.getSelection())
  };

  // construct menu
  const menuItems = [
    copySourceItem,
    copySourceUri2Item,
    copyFunctionItem,
    { type: "separator" },
    jumpToMappedLocationItem,
    showSourceMenuItem,
    blackBoxMenuItem
  ];

  // conditionally added items
  // TODO: Find a new way to only add this for mapped sources?
  if (textSelected) {
    menuItems.push(watchExpressionItem);
  }

  return menuItems;
}

class EditorMenu extends PureComponent {
  props: Props;

  constructor() {
    super();
  }

  shouldComponentUpdate(nextProps) {
    return nextProps.contextMenu.type === "Editor";
  }

  componentWillUpdate(nextProps) {
    // clear the context menu since it is open
    this.props.setContextMenu("", null);
    return this.showMenu(nextProps);
  }

  showMenu(nextProps) {
    const { contextMenu, ...options } = nextProps;
    const { event } = contextMenu;
    showMenu(event, getMenuItems(event, options));
  }

  render() {
    return null;
  }
}

const {
  addExpression,
  flashLineRange,
  jumpToMappedLocation,
  setContextMenu,
  showSource,
  toggleBlackBox
} = actions;

export default connect(
  state => {
    const selectedSource = getSelectedSource(state);
    return {
      selectedLocation: getSelectedLocation(state),
      selectedSource,
      hasPrettyPrint: !!getPrettySource(state, selectedSource.get("id")),
      contextMenu: getContextMenu(state),
      getFunctionText: line =>
        findFunctionText(
          line,
          selectedSource.toJS(),
          getSymbols(state, selectedSource.toJS())
        ),
      getFunctionLocation: line =>
        findClosestScope(getSymbols(state, selectedSource.toJS()).functions, {
          line,
          column: Infinity
        })
    };
  },
  {
    addExpression,
    flashLineRange,
    jumpToMappedLocation,
    setContextMenu,
    showSource,
    toggleBlackBox
  }
)(EditorMenu);
