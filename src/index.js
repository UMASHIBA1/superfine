var RECYCLED_NODE = 1;
var TEXT_NODE = 3;
var EMPTY_OBJ = {};
var EMPTY_ARR = [];
var map = EMPTY_ARR.map;
var isArray = Array.isArray;

// NOTE 更新前のVNodeにあったプロパティが更新後のVNodeにも確実にあるように
// 更新前のプロパティと更新後のプロパティを合併する
var merge = function (a, b) {
  var out = {};

  for (var k in a) out[k] = a[k];
  for (var k in b) out[k] = b[k];

  return out;
};

var listener = function (event) {
  this.handlers[event.type](event);
};

// NOTE 既にDOMが存在していた場合に使う関数、プロパティを変更する
var patchProperty = function (node, key, oldValue, newValue, isSvg) {
  // NOTE nodeは対象の要素のDOM参照
  // NOTE keyはid,classとかtypeとかのプロパティ名
  if (key === "key") {
  }
  // NOTE onClickとかonSubmitとかのイベントリスナー系の場合の処理
  else if (key[0] === "o" && key[1] === "n") {
    // NOTE newValueがnull等の場合、前のイベントリスナーを発火させなくする
    if (
      // NOTE node.handlersにはclick,submitなどのkeyが割り振られ
      // それに対応した発火関数が渡される
      !((node.handlers || (node.handlers = {}))[
        (key = key.slice(2).toLowerCase())
      ] = newValue)
    ) {
      node.removeEventListener(key, listener);
    }
    // NOTE もし変更前の状態でイベントリスナーを使ってなかったらaddEventListenerをする
    else if (!oldValue) {
      node.addEventListener(key, listener);
    }
    // NOTE イベントリスナーの呼びだす関数が変わっただけの場合は
    // イベントリスナーが発火させる関数のリストであるnode.handlersの中身を変えてあるため
    // addEventListner等する必要がない
  } else if (!isSvg && key !== "list" && key in node) {
    node[key] = newValue == null ? "" : newValue;
  } else if (newValue == null || newValue === false) {
    node.removeAttribute(key);
  } else {
    node.setAttribute(key, newValue);
  }
};

var createNode = function (vnode, isSvg) {
  var node =
    vnode.type === TEXT_NODE
      ? document.createTextNode(vnode.name)
      : (isSvg = isSvg || vnode.name === "svg")
      ? document.createElementNS("http://www.w3.org/2000/svg", vnode.name)
      : document.createElement(vnode.name);
  var props = vnode.props;

  for (var k in props) {
    patchProperty(node, k, null, props[k], isSvg);
  }

  for (var i = 0, len = vnode.children.length; i < len; i++) {
    node.appendChild(createNode(vnode.children[i], isSvg));
  }

  return (vnode.node = node);
};

// NOTE VNodeからkeyを取り出す
// keyを持つ要素を渡されたらkeyを返す、keyを持たない普通の要素を渡されたらundefinedを返す
var getKey = function (vnode) {
  console.log(
    "getKey: ",
    vnode == null ? null : vnode.key,
    "VNode: ",
    vnode,
    "vnode.key: ",
    vnode.key
  );
  return vnode == null ? null : vnode.key;
};

// NOTE 実際に更新を行う関数っぽい
var patchNode = function (parent, node, oldVNode, newVNode, isSvg) {
  // parent: DOMの追加先のparentNode, ←変更、コード見た感じDOMの追加先
  // node: DOMの追加先, ←変更、oldVNodeに対応するDOM参照
  // oldVNode: 変更前のVNodeが入る
  // newVNode: 変更したVNodeが入る

  // NOTE 1. 前のVNodeと比較変更なしだったら何もしない
  if (oldVNode === newVNode) {
  }
  // NOTE 1. 文字変更の場合(もし変更前のVNodeも変更後のVNodeもTEXT_NODEだったらそのVNodeの文字列だけ変える)
  else if (
    oldVNode != null &&
    oldVNode.type === TEXT_NODE &&
    newVNode.type === TEXT_NODE
  ) {
    if (oldVNode.name !== newVNode.name) node.nodeValue = newVNode.name;
  }
  // NOTE 1. 対象要素の追加、削除、種類入れ替えの場合(divとかがspanになってる等、要素自体が違う場合はdivを破棄してspanを追加する処理をする)
  else if (oldVNode == null || oldVNode.name !== newVNode.name) {
    // XXX なぜdocument.getElementByIdで取得した要素の前に新しいNodeを追加してるのか謎 ←一応parentの解釈を変えた
    node = parent.insertBefore(createNode(newVNode, isSvg), node);
    if (oldVNode != null) {
      parent.removeChild(oldVNode.node);
    }
  }
  // NOTE 1. 対象要素の更新
  else {
    var tmpVKid;
    var oldVKid;

    var oldKey;
    var newKey;

    var oldVProps = oldVNode.props;
    var newVProps = newVNode.props;

    var oldVKids = oldVNode.children;
    var newVKids = newVNode.children;

    var oldHead = 0;
    var newHead = 0;
    var oldTail = oldVKids.length - 1;
    var newTail = newVKids.length - 1;

    isSvg = isSvg || newVNode.name === "svg";

    // NOTE 2. 対象要素の更新処理

    // NOTE このfor文では実際にDOM要素のプロパティを変える
    for (var i in merge(oldVProps, newVProps)) {
      // NOTE 入力系(value,selected,checked)は本物のDOMの値を取得して
      // 変更後のVNodeの値と違いがないか比較
      if (
        (i === "value" || i === "selected" || i === "checked"
          ? node[i]
          : oldVProps[i]) !== newVProps[i]
      ) {
        // NOTE nodeに対して新しいVNodeのプロパティの値を適応する
        patchProperty(node, i, oldVProps[i], newVProps[i], isSvg);
      }
    }

    // NOTE 3. 子要素の追加、削除、更新処理
    // NOTE ※superfineはReactと同じように並列的な要素にkeyを使う
    // 普通の要素はkeyのプロパティはundefinedになってる

    // NOTE 子要素をchildrenリストの前の方から探索していって
    // できるところ(newVNodeの方で削除とか追加されてたりして
    // その要素が比較できなくなるまで)まで更新している
    // NOTE ※ちなみにkeyを持たない要素でもkeyがundefinedになっていて一致するためここでpatch処理がされる
    while (newHead <= newTail && oldHead <= oldTail) {
      if (
        (oldKey = getKey(oldVKids[oldHead])) == null ||
        oldKey !== getKey(newVKids[newHead])
      ) {
        break;
      }

      patchNode(
        node,
        oldVKids[oldHead].node,
        oldVKids[oldHead++],
        newVKids[newHead++],
        isSvg
      );
    }

    // NOTE keyを持つ子要素をchildrenリストの前の方から探索していって
    // できるところ(newVNodeの方で削除とか追加されてたりして
    // その要素が比較できなくなるまで)まで更新している
    // NOTE ※ちなみにkeyを持たない要素でもkeyがundefinedになっていて一致するためここでpatch処理がされる
    while (newHead <= newTail && oldHead <= oldTail) {
      if (
        (oldKey = getKey(oldVKids[oldTail])) == null ||
        oldKey !== getKey(newVKids[newTail])
      ) {
        break;
      }

      patchNode(
        node,
        oldVKids[oldTail].node,
        oldVKids[oldTail--],
        newVKids[newTail--],
        isSvg
      );
    }

    // NOTE oldHeadがoldTailより大きい場合、変更後のVNodeで要素が1つ増えていることを示す
    // なので、追加されていた順番の位置に要素を追加する
    if (oldHead > oldTail) {
      while (newHead <= newTail) {
        node.insertBefore(
          createNode(newVKids[newHead++], isSvg),
          (oldVKid = oldVKids[oldHead]) && oldVKid.node
        );
      }
    }
    // NOTE newHeadがnewTailより大きい場合、変更後のVNodeで要素が1つ減っていることを示す
    // なので減った要素をDOMから削除する
    else if (newHead > newTail) {
      while (oldHead <= oldTail) {
        node.removeChild(oldVKids[oldHead++].node);
      }
    }

    // NOTE 子要素で二つ以上要素追加もしくは削除した場合
    else {
      // NOTE 準備として上のwhile文で更新できていない子要素でkeyを持つものを全てkeyedというオブジェクトに保存する
      for (var i = oldHead, keyed = {}, newKeyed = {}; i <= oldTail; i++) {
        // oldVKidsはoldVNode.childrenを指していた
        if ((oldKey = oldVKids[i].key) != null) {
          keyed[oldKey] = oldVKids[i];
        }
      }

      while (newHead <= newTail) {
        oldKey = getKey((oldVKid = oldVKids[oldHead]));
        newKey = getKey(newVKids[newHead]);

        // NOTE oldKeyではあった子要素が削除されている場合
        // つまり削除された要素をとばす為の処理
        if (
          newKeyed[oldKey] ||
          (newKey != null && newKey === getKey(oldVKids[oldHead + 1]))
        ) {
          // oldKeyがnullもしくはundefinedの場合
          if (oldKey == null) {
            // NOTE この関数の最後にいらない子要素はkeyをもとにして削除するけど
            // keyがnullもしくはkeyを定義されていないモノはできなくなってしまうからここで消す
            node.removeChild(oldVKid.node);
          }
          oldHead++;
          continue;
        }

        // 変更後の要素のkeyがnullもしくはundefined、または変更前の要素がRECYCLED_NODEの場合
        if (newKey == null || oldVNode.type === RECYCLED_NODE) {
          if (oldKey == null) {
            patchNode(
              node,
              oldVKid && oldVKid.node,
              oldVKid,
              newVKids[newHead],
              isSvg
            );
            newHead++;
          }
          oldHead++;
        }
        // 並列要素用にkeyがあるものの場合
        else {
          // NOTE 普通にkeyが同じだった場合、patchNodeで更新する
          // つまりkeyを持った要素の更新処理
          if (oldKey === newKey) {
            patchNode(node, oldVKid.node, oldVKid, newVKids[newHead], isSvg);
            newKeyed[newKey] = true;
            oldHead++;
          } else {
            // NOTE 更新前のVNodeに既に同じkeyを持った要素が存在した場合、
            if ((tmpVKid = keyed[newKey]) != null) {
              patchNode(
                node,
                node.insertBefore(tmpVKid.node, oldVKid && oldVKid.node),
                tmpVKid,
                newVKids[newHead],
                isSvg
              );
              newKeyed[newKey] = true;
            }
            // NOTE ここまでkeyを持った要素の更新処理について記述している

            // NOTE 更新前のVNodeに同じkeyを持った要素が存在しない場合
            // つまりkeyを持った要素の追加処理
            else {
              patchNode(
                node,
                oldVKid && oldVKid.node,
                null,
                newVKids[newHead],
                isSvg
              );
            }
          }
          newHead++;
        }
      }

      // 変更前の要素のkeyが指定されていない要素やnullの要素でこの前に削除されなかったモノを削除
      while (oldHead <= oldTail) {
        if (getKey((oldVKid = oldVKids[oldHead++])) == null) {
          node.removeChild(oldVKid.node);
        }
      }

      // NOTE keyを持ってた変更前要素のうち、削除されたものをここで一気に消す
      for (var i in keyed) {
        if (newKeyed[i] == null) {
          node.removeChild(keyed[i].node);
        }
      }
    }
  }

  // VDOMのnodeというプロパティにDOM参照を入れる
  return (newVNode.node = node);
};

var createVNode = function (name, props, children, node, key, type) {
  // NOTE keyはkeyプロパティが入る
  return {
    name: name,
    props: props,
    children: children, // NOTE childrenの中にはcreateVNodeで作成したVNodeのリストが入る
    node: node,
    type: type, // NOTE typeはTEXTとかDOMとかそういったVNodeのタイプを表す符号
    key: key,
  };
};

var createTextVNode = function (value, node) {
  return createVNode(value, EMPTY_OBJ, EMPTY_ARR, node, null, TEXT_NODE);
};

// たぶんこの関数は実際のDOMからVDOMを作成する関数
var recycleNode = function (node) {
  // NOTE TEXT_NODEの場合はnameにStringが入る
  return node.nodeType === TEXT_NODE
    ? createTextVNode(node.nodeValue, node)
    : createVNode(
        node.nodeName.toLowerCase(),
        EMPTY_OBJ,
        map.call(node.childNodes, recycleNode),
        node,
        null,
        RECYCLED_NODE
      );
};

// NOTE nodeがgetElementByIdで所得した追加先の要素
// NOTE vdomは追加するVNode
export var patch = function (node, vdom) {
  return (
    ((node = patchNode(
      node.parentNode,
      node,
      node.vdom || recycleNode(node),
      vdom
    )).vdom = vdom),
    node
  );
};

// NOTE これがpatch関数に渡される
export var h = function (name, props) {
  //nameにdiv等の要素名, propsにプロパティが入ってる
  // NOTE 1. 子要素(h(h1,...))を全てrestに入れる
  // NOTE またvnodeとchildrenを宣言する
  for (var vnode, rest = [], children = [], i = arguments.length; i-- > 2; ) {
    rest.push(arguments[i]);
  }

  while (rest.length > 0) {
    // NOTE 2. Arrayで渡されていた子要素を一つ一つ取り出してrestに入れる
    if (isArray((vnode = rest.pop()))) {
      for (var i = vnode.length; i-- > 0; ) {
        rest.push(vnode[i]);
      }
    } else if (vnode === false || vnode === true || vnode == null) {
    } else {
      // NOTE 3. [2.]でrestに入れた子要素を確実にVNodeの形に直してからchildrenに入れる
      children.push(typeof vnode === "object" ? vnode : createTextVNode(vnode)); // ※createTextVNodeでVNodeの形式に変換する
    }
  }

  props = props || EMPTY_OBJ;

  // NOTE たぶんReactのコンポーネントみたいな関数が渡されたときはその関数を呼んで返すんだと思う
  return typeof name === "function"
    ? name(props, children)
    : // NOTE nameの要素のVNodeをchildrenVNode付きで返す
      createVNode(name, props, children, null, props.key);
};
