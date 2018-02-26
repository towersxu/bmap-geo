/**
 * 百度地图GEO绘制工具
 * @export
 * @class BmapGeo
 * @author xutao <987427795@qq.com>
 */
let guidIndex = 1
let BMap = window.BMap || {}
let Control = BMap.Control || function () {}
// import { locationImage } from './dataimage'

export class BmapGeo {
  /**
   * 构造函数，返回一个BmapGeo对象
   * @param {baidumap} map 地图对象
   * @param {geojson} geo 默认数据
   * @memberof BmapGeo
   */
  constructor (map, geo) {
    this.map = map
    this.polygons = [] // 区域点数据。
    let geoCollection = new GeoCollection()
    this.markers = [] // geo中的点数据
    this.points = [] // geo中点对象
    this.polygonPaths = [] // 区域路径，bmap路径对象
    this.polygonPoints = [] // 区域点，bmap点对象
    this.events = {
      delete: function () {},
      add: function () {},
      change: function () {}
    }
    this.geoCollection = geoCollection
    if (geo && geo.type === 'FeatureCollection' && geo.features && geo.features.length > 0) {
      let features = geo.features
      features.map(f => {
        if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates) {
          this._createPolygon(f.geometry.coordinates[0][0])
        }
      })
      features.map(f => {
        if (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates) {
          this._createPoint(f.geometry.coordinates)
        }
      })
    }
  }
  /**
   * 以地图内控件的方式，显示控制图标
   * @memberof BmapGeo
   */
  showControl () {
    let pointControl = new PointControl()
    this.map.addControl(pointControl)
    pointControl.on('begin', () => {
      this.open(2, function () {})
      polygonControl.stop()
    })
    pointControl.on('stop', () => {
      this.close()
    })

    let polygonControl = new PolygonControl()
    this.map.addControl(polygonControl)
    polygonControl.on('begin', () => {
      this.open(1, function () { })
      pointControl.stop()
    })
    polygonControl.on('stop', () => {
      this.close()
    })
  }
  /**
   * 开始绘制
   * @param {number} type 绘制的模式，1表示绘制区域polygon，2表示绘制坐标点point
   * @memberof BmapGeo
   */
  open (type = 1, callback) {
    this.clear()
    this.callback = callback
    this.type = type
    type === 1 ? this.drawPolygon() : this.drawPoint()
  }
  /**
   * 结束绘制
   * @memberof BmapGeo
   */
  close () {
    this.map.removeEventListener('click', this._drawPolygonClickHandler, false)
    this.map.removeEventListener('mousemove', this._drawPolygonMoveHandler, false)
    this.map.removeEventListener('click', this._drawPointClickHandler, false)
    this.polygonPaths.map(p => p.remove())
    this.polygonPoints.map(p => p.remove())
    if (this.callback) {
      this.callback(this.geoCollection)
    }
  }
  /**
   * 清除使用后生成的数据，便于重新使用。
   * @memberof BmapGeo
   */
  clear () {
    this.points = []
    this.polygons = []
    this.polygonPaths = []
    this.polygonPoints = []
    this.close()
  }
  /**
   * 监听事件
   * @event on
   * @param {string} name 事件名称
   * @param {function} handle 事件触发时回调函数
   * @memberof BmapGeo
   */
  on (name, handle) {
    this.events[name] = handle
  }
  /**
   * 触发事件
   * @param {string} name 触发的事件名称
   * @memberof BmapGeo
   */
  emit (name, ...args) {
    this.events[name].apply(this, args)
  }
  /**
   * 绘制点
   * @memberof BmapGeo
   */
  drawPoint () {
    this._drawPointClickHandler = this._drawPointClick.bind(this)
    this.map.addEventListener('click', this._drawPointClickHandler, false)
  }
  /**
   * 绘制区域
   * @memberof BmapGeo
   */
  drawPolygon () {
    // @see https://stackoverflow.com/questions/11565471/removing-event-listener-which-was-added-with-bind
    this._drawPolygonClickHandler = this._drawPolygonClick.bind(this)
    this.map.addEventListener('click', this._drawPolygonClickHandler, false)
    this._drawPolygonMoveHandler = this._drawPolygonMove.bind(this)
    this.map.addEventListener('mousemove', this._drawPolygonMoveHandler, false)
  }
  /**
   * 绘制区域时，处理鼠标移动动作
   * @param {event} e 事件对象
   * @memberof BmapGeo
   * @private
   */
  _drawPolygonMove (e) {
    let pt = e.point
    if (this.polygons.length === 0) { // 如果没有测量点，则表示还没有开始绘制
      return
    }
    // 怎么处理折线绘制？
    // 肯定不能触发一次移动就创建和销毁一个折线，太影响性能了，所以需要在点击的时候，
    // 在点击的点创建一个开始点和结束点在同一个点的折线。
    // 然后在移动的时候，将此折线的结束点设置为当前鼠标的位置。
    this.movePath.setPositionAt(1, pt)
  }
  _createPolygon (points) {
    let geoPolygon = new GeoPolygon(points)
    geoPolygon.show(this.map)
    geoPolygon.addToGeoCollection(this.geoCollection)
    this.emit('add', 'polygon', this.geoCollection.getJSONObject())
    geoPolygon.on('delete', () => {
      this.emit('delete', 'polygon', this.geoCollection.getJSONObject())
      geoPolygon = null
    })
    geoPolygon.on('change', () => {
      this.emit('change', 'polygon', this.geoCollection.getJSONObject())
    })
  }
  _createPoint (point) {
    let geoPoint = new GeoPoint(point[0], point[1])
    geoPoint.show(this.map)
    geoPoint.addToGeoCollection(this.geoCollection)
    this.emit('add', 'point', this.geoCollection.getJSONObject())
    geoPoint.on('delete', () => {
      this.emit('delete', 'point', this.geoCollection.getJSONObject())
      geoPoint = null
    })
    geoPoint.on('change', () => {
      this.emit('change', 'point', this.geoCollection.getJSONObject())
    })
  }
  /**
   * 绘制区域时，处理点击动作
   * @param {event} e 点击事件对象
   * @memberof BmapGeo
   * @private
   */
  _drawPolygonClick (e) {
    this.stopBubble(e)
    let pt = e.point
    if (!this._isPointValid(pt)) {
      return
    }
    this._addSecPoint(pt)
    if (this.polygons.length > 0) { // 如果之前已经有选择点了，那么就绘制路径。
      this.movePath.setPositionAt(1, pt) // 因为已经存在一个在前一个点位置处的路径，所以只需要修改其结束点为当前点即可。
      this.polygonPaths.push(this.movePath)
    }
    // 绘制区域至少要3个点，所以3个点时，开始判断是否绘制完成
    if (this.polygons.length > 2 && this._isTwoPointNear(this.polygons[0], pt)) {
      this._createPolygon(this.points)
      this.polygonPaths.map(p => p.remove())
      this.polygonPoints.map(p => p.remove())
      this.polygons = []
      this.points = []
    } else { // 没有绘制完成，那么创建一个供鼠标移动显示的路径
      this.movePath = new BMap.Polyline([pt, pt], { enableMassClear: true })
      this.map.addOverlay(this.movePath)
      this.polygons.push(pt)
      this.points.push([pt.lat, pt.lng])
    }
  }
  _drawPointClick (e) {
    let pt = e.point
    if (!this._isPointValid(pt)) {
      return
    }
    this._createPoint([pt.lat, pt.lng])
  }
  /**
   * 在地图上绘制指定的点
   * @param {object} pt point对象
   * @memberof BmapGeo
   * @private
   */
  _addSecPoint (pt) {
    let ico = new BMap.Icon('http://api.map.baidu.com/images/mapctrls.png', new BMap.Size(11, 11), { imageOffset: new BMap.Size(-26, -313) })
    let secPt = new BMap.Marker(pt, {
      icon: ico,
      clickable: false,
      baseZIndex: 3500000,
      zIndexFixed: true,
      enableMassClear: true
    })
    this.map.addOverlay(secPt)
    this.polygonPoints.push(secPt)
  }
  /**
   * 判断出现的点是否超出了当前界面显示的区域
   * _addSecPoint
   * @param {object} pt 点击事件产生的point对象
   * @returns {boolean}
   * @memberof BmapGeo
   * @private
   */
  _isPointValid (pt) {
    if (!pt) {
      return false
    }
    let mapBounds = this.map.getBounds()
    let sw = mapBounds.getSouthWest()
    let ne = mapBounds.getNorthEast()
    if (pt.lng < sw.lng ||
      pt.lng > ne.lng ||
      pt.lat < sw.lat ||
      pt.lat > ne.lat) {
      return false
    }
    return true
  }
  /**
   * 阻止事件冒泡
   * @param {event} e 事件对象
   * @memberof BmapGeo
   * @private
   */
  stopBubble (e) {
    e = window.event || e
    e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true
  }
  /**
   * 判断两个点是否靠近
   * @param {point} pt1 点1
   * @param {point} pt2 点2
   * @param {number} [space=5] 判断距离的值，默认为5像素
   * @returns { boolean }
   * @memberof BmapGeo
   * @private
   */
  _isTwoPointNear (pt1, pt2, space = 5) {
    let point1 = this.map.pointToPixel(pt1)
    let point2 = this.map.pointToPixel(pt2)
    let distence = Math.sqrt(Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2))
    return distence < space
  }
  /**
   * 删除指定的标记点
   * 
   * @param {object<marker>} marker 标记点对象
   * @memberof BmapGeo
   */
  removeMarker (marker) {
    this.map.removeOverlay(marker)
  }
}
/**
 * GEO元素基础信息
 * @class GeoObject
 */
class GeoObject {
  constructor (properties = {}, geometry = {}) {
    this.type = 'Feature'
    this.properties = properties
    this.properties.bmapId = 'feature__' + (guidIndex++).toString(36)
    this.geometry = geometry
    this.events = {
      delete: function () {},
      change: function () {}
    }
  }
  /**
   * 设置属性
   * @param {string} key 属性key
   * @param {any} value 属性值
   * @memberof GeoObject
   */
  setProperty (key, value) {
    this.properties[key] = value
  }
  /**
   * 获取属性
   * @param {string} key 属性键
   * @returns {string} 属性值
   * @memberof GeoObject
   */
  getProperty (key) {
    return this.properties[key]
  }
  /**
   * 删除属性
   * @param {string} key 属性键
   * @memberof GeoObject
   */
  deleteProperty (key) {
    delete this.properties[key]
  }
  /**
   * 显示GEO元素在指定地图上
   * @abstract 
   * @param {any} map 
   * @memberof GeoObject
   */
  show(map) {
    this.setContextMeun()
  }
  /**
   * 隐藏GEO元素
   * @param {any} map 
   * @memberof GeoObject
   */
  hide(map) {
    map.removeOverlay(this.geoEl)
    this.geoCollection.removeFeature(this.properties.bmapId)
    // todo 派发删除事件
    this.emit('delete')
  }
  setName (map) {
    let div = document.createElement('div')
    let div1 = document.createElement('div')
    let name = document.createElement('span')
    name.innerText = 'name'
    let input = document.createElement('input')
    input.setAttribute('type', 'text')
    input.setAttribute('value', this.properties.name || '')
    let button = document.createElement('button')
    button.innerText = '确定'
    button.addEventListener('click', () => {
      this.properties.name = input.value
      map.closeInfoWindow()
      this.emit('change')
    })
    div.appendChild(div1)
    div.appendChild(button)
    div1.appendChild(name)
    div1.appendChild(input)
    let infoWindow = new BMap.InfoWindow(div)
    let point = { lat: 0, lng: 0 }
    if (this.geometry.type === 'Point') {
      let coordinates = this.geometry.coordinates
      point = new BMap.Point(coordinates[1], coordinates[0])
    }
    else {
      let coordinates = this.geometry.coordinates[0][0][0] // 取区域的第一个点做弹出点
      point = new BMap.Point(coordinates[1], coordinates[0])
    }
    map.openInfoWindow(infoWindow, point)
  }
  on (eventName, fn) {
    this.events[eventName] = fn
  }
  emit (eventName, ...argv) {
    this.events[eventName](argv)
  }
  setContextMeun (map) {
    let markerMenu = new BMap.ContextMenu()
    markerMenu.addItem(new BMap.MenuItem('删除', () => {
      this.hide(map)
    }))
    markerMenu.addItem(new BMap.MenuItem('设置名称', () => {
      this.setName(map)
    }))
    this.geoEl.addContextMenu(markerMenu)
  }
  /**
   * 获取绘制坐标
   * @abstract 
   * @memberof GeoObject
   */
  getPolygonPoints () {}
  addToGeoCollection (geoCollection) {
    this.geoCollection = geoCollection
    this.geoCollection.addFeature(this)
  }
}
/**
 * 绘制GEO元素-点，存储点的信息
 * 
 * @class GeoPoint
 * @extends {GeoObject}
 */
class GeoPoint extends GeoObject {
  constructor(x, y) {
    super()
    this.geometry = {
      type: 'Point',
      coordinates: [x, y]
    }
  }
  getJSONObject () {
    let obj = {
      type: this.type,
      properties: this.properties,
      geometry: this.geometry,
    }
    return obj
  }
  getPolygonPoints () {
    let coordinates = this.geometry.coordinates
    return {
      lat: coordinates[0],
      lng: coordinates[1]
    }
  }
  /**
   * 显示GEO元素在指定地图上
   * @param {any} map 
   * @memberof GeoObject
   */
  show(map) {
    this.geoEl = new BMap.Marker(this.getPolygonPoints())
    map.addOverlay(this.geoEl)
    this.setContextMeun(map)
  }
}
/**
 * 绘制GEO元素-区域，存储区域所有点信息
 * @class GeoPolygon
 * @extends {GeoObject}
 */
class GeoPolygon extends GeoObject {
  constructor(points) {
    super()
    this.geometry = {
      type: 'Polygon',
      coordinates: [
        [
          points
        ]
      ]
    }
  }
  /**
   * 显示GEO元素在指定地图上
   * @param {any} map 
   * @memberof GeoObject
   */
  show(map) {
    this.geoEl = new BMap.Polygon(this.getPolygonPoints(), {
      strokeColor: 'blue',
      strokeWeight: 3,
      strokeOpacity: 0.5
    })
    map.addOverlay(this.geoEl)
    this.setContextMeun(map)
  }
  getPolygonPoints () {
    let ps = this.geometry.coordinates[0][0]
    return ps.map(s => {
      return { lat: s[0], lng: s[1] }
    })
  }
  getJSONObject () {
    let obj = {
      type: this.type,
      properties: this.properties,
      geometry: this.geometry,
    }
    return obj
  }
}

/**
 * GEO对象集合，
 * @class GeoCollection
 */
class GeoCollection {
  constructor(features = []) {
    this.type = 'FeatureCollection'
    this.features = features
  }
  /**
   * 添加feature
   * 
   * @param {object<feature>} feature GEO元素
   * @returns {number} 添加后features的个数，0表示添加失败。 
   * @memberof GeoCollection
   */
  addFeature (feature) {
    return feature.type === 'Feature' && feature.properties && feature.properties.bmapId ? this.features.push(feature) : 0
  }
  /**
   * 获取feature
   * @param {string} id featureId
   * @returns {object<feature>} GEO元素
   * @memberof GeoCollection
   */
  getFeature (id) {
    return this._getFeatureOrIndex(id)
  }
  /**
   * 获取feature所在的位置
   * @returns {number} 位置，-1表示没有这个元素
   * @memberof GeoCollection
   */
  getFeatureIndex (id) {
    return this._getFeatureOrIndex(id, true)
  }
  _getFeatureOrIndex (id, isIndex) {
    let features = this.features
    for (let i = 0; i < features.length; i++) {
      let feature = features[i]
      if (feature.properties && feature.properties.bmapId === id) {
        return isIndex ? i : feature
      }
    }
    return isIndex ? -1 : null
  }
  // todo 从集合中删除元素
  /**
   * 删除feature
   * @param {string} id 元素Id
   * @returns {object<feature>} 被删除的元素
   * @memberof GeoCollection
   */
  removeFeature (id) {
    let index = this.getFeatureIndex(id)
    return index === -1 ? null : this.features.splice(index, 1)
  }
  getJSONObject () {
    let features = []
    this.features.map(f => features.push(f.getJSONObject()))
    let json = {
      "type": this.type,
      "features": features
    }
    return json
  }
  toString () {
    return JSON.stringify(this.getJSONObject())
  }
}
/**
 * 地图控件-点击开启绘制点
 * @class PointControl
 */
class PointControl extends Control {
  constructor(defaultAnchor = window.BMAP_ANCHOR_TOP_RIGHT) {
    super()
    this.defaultAnchor = defaultAnchor
    this.defaultOffset = new BMap.Size(10, 20)
    this.events = {
      begin: function () {},
      stop: function () {}
    }
  }
  initialize (map) {
    let div = document.createElement('div')
    div.className = 'point-control-option'
    div.title = '点击开始设置坐标点'
    div.onclick = (e) => {
      if (div.className === 'point-control-option active') {
        div.className = 'point-control-option'
        map.setDefaultCursor('url("http://api0.map.bdimg.com/images/openhand.cur") 8 8, default')
        map.enableDragging()
        this.emit('stop')
      }
      else {
        div.className = 'point-control-option active'
        map.setDefaultCursor('crosshair')
        map.disableDragging()
        this.emit('begin')
      }
    }
    map.getContainer().appendChild(div)
    addStylesheetRules([
      [
        '.point-control-option',
        ['width', '20px'],
        ['height', '20px'],
        ['cursor', 'pointer'],
        ['background', 'url(http://7xrmyu.com1.z0.glb.clouddn.com/location1.png) center center'],
        ['background-size', '20px']
      ],
      [
      '.point-control-option.active',
        ['background', 'url(http://7xrmyu.com1.z0.glb.clouddn.com/location2.png) center center'],
        ['background-size', '20px']
      ]
    ])
    this.div = div
    return div
  }
  stop () {
    this.div.className = 'point-control-option'
  }
  on(eventName, callback) {
    this.events[eventName] = callback
  }
  emit(name, ...args) {
    this.events[name].call(this, args)
  }
}

class PolygonControl extends Control {
  constructor(defaultAnchor = window.BMAP_ANCHOR_TOP_RIGHT) {
    super()
    this.defaultAnchor = defaultAnchor
    this.defaultOffset = new BMap.Size(10, 50)
    this.events = {
      begin: function () { },
      stop: function () { }
    }
  }
  initialize(map) {
    let div = document.createElement('div')
    div.className = 'polygon-control-option'
    div.title = '点击开始绘制区域'
    div.onclick = (e) => {
      if (div.className === 'polygon-control-option active') {
        div.className = 'polygon-control-option'
        map.enableDragging()
        this.emit('stop')
      }
      else {
        div.className = 'polygon-control-option active'
        map.disableDragging()
        this.emit('begin')
      }
    }
    map.getContainer().appendChild(div)
    addStylesheetRules([
      [
        '.polygon-control-option',
        ['width', '20px'],
        ['height', '20px'],
        ['cursor', 'pointer'],
        ['background', 'url(http://7xrmyu.com1.z0.glb.clouddn.com/area1.png) center center'],
        ['background-size', '20px']
      ],
      [
        '.polygon-control-option.active',
        ['background', 'url(http://7xrmyu.com1.z0.glb.clouddn.com/area2.png) center center'],
        ['background-size', '20px']
      ]
    ])
    this.div = div
    return div
  }
  stop() {
    this.div.className = 'point-control-option'
  }
  on(eventName, callback) {
    this.events[eventName] = callback
  }
  emit(name, ...args) {
    this.events[name].call(this, args)
  }
}

/**
 * @see https://developer.mozilla.org/zh-CN/docs/Web/API/CSSStyleSheet/insertRule
 * Add a stylesheet rule to the document (may be better practice, however,
 *  to dynamically change classes, so style information can be kept in
 *  genuine styesheets (and avoid adding extra elements to the DOM))
 * Note that an array is needed for declarations and rules since ECMAScript does
 * not afford a predictable object iteration order and since CSS is 
 * order-dependent (i.e., it is cascading); those without need of
 * cascading rules could build a more accessor-friendly object-based API.
 * @param {Array} decls Accepts an array of JSON-encoded declarations
 * @example
addStylesheetRules([
  ['h2', // Also accepts a second argument as an array of arrays instead
    ['color', 'red'],
    ['background-color', 'green', true] // 'true' for !important rules 
  ], 
  ['.myClass', 
    ['background-color', 'yellow']
  ]
]);
 */
function addStylesheetRules(decls) {
  var style = document.createElement('style')
  document.getElementsByTagName('head')[0].appendChild(style)
  if (!window.createPopup) {
    style.appendChild(document.createTextNode(''))
  }
  var s = document.styleSheets[document.styleSheets.length - 1]
  for (var i = 0, dl = decls.length; i < dl; i++) {
    var j = 1, decl = decls[i], selector = decl[0], rulesStr = ''
    if (Object.prototype.toString.call(decl[1][0]) === '[object Array]') {
      decl = decl[1]
      j = 0
    }
    for (var rl = decl.length; j < rl; j++) {
      var rule = decl[j]
      rulesStr += rule[0] + ':' + rule[1] + (rule[2] ? ' !important' : '') + ';\n'
    }

    if (s.insertRule) {
      s.insertRule(selector + '{' + rulesStr + '}', s.cssRules.length)
    }
    else { /* IE */
      s.addRule(selector, rulesStr, -1)
    }
  }
}
