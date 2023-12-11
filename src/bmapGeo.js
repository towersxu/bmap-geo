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

class BmapGeo {
  /**
   * 构造函数，返回一个BmapGeo对象
   * @param {baidumap} map 地图对象
   * @param {geojson} geo 默认数据
   * @param {polygonRemoveEnd} geo 默认数据
   * @memberof BmapGeo
   */
  constructor (map, geo, polygonRemoveEnd) {
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
          this._createPolygon(f.geometry.coordinates[0])
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
  showControl(config = {
    point: true,
    polygon: true,
    area: true
  }) {
    let controls = {
      _data: [],
      push: function (val) {
        this._data.push(val)
      },
      stop: function () {
        this._data.forEach((control) => {
          control.stop()
        })
      }
    }
    if (config.point) {
      let pointControl = new PointControl()
      this.map.addControl(pointControl)
      pointControl.on('begin', () => {
        controls.stop()
        this.open(2, function () { })
      })
      pointControl.on('stop', () => {
        this.close()
      })
      controls.push(pointControl)
    }

    if (config.polygon) {
      let polygonControl = new PolygonControl()
      this.map.addControl(polygonControl)
      polygonControl.on('begin', () => {
        controls.stop()
        this.open(1, function () { })
      })
      polygonControl.on('stop', () => {
        this.close()
      })
      controls.push(polygonControl)
    }

    if (config.area) {
      let areaControl = new AreaControl()
      this.map.addControl(areaControl)
      areaControl.on('begin', () => {
        controls.stop()
        this.open(1, function () { })
      })
      areaControl.on('stop', () => {
        this.close()
      })
      areaControl.on('search', (val) => {
        var bdary = new BMap.Boundary()
        bdary.get(val, (rs) => {       //获取行政区域
          // map.clearOverlays();        //清除地图覆盖物       
          var count = rs.boundaries.length; //行政区域的点有多少个
          if (count === 0) {
            alert('未能获取当前输入行政区域');
            return;
          }
          let points = []
          let boundaryMax = []
          // FIXME: 这里只取主要区域，暂时不兼容多个区域
          rs.boundaries.forEach((boundary) => {
            if (boundary.length > boundaryMax.length) {
              boundaryMax = boundary
            }
          })
          points = boundaryMax.split(';')
          points = points.map((point) => {
            return point.split(',').map((p) => {
              return Number(p)
            })
          })
          this._createPolygon(points)
        });
      })
      controls.push(areaControl)
    }
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
    this.map.setViewport(points.map((p) => {
      return new BMap.Point(p[0], p[1])
    }))
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
      this.points.push([pt.lng, pt.lat])
    }
  }
  _drawPointClick (e) {
    let pt = e.point
    console.log(pt)
    if (!this._isPointValid(pt)) {
      return
    }
    this._createPoint([pt.lng, pt.lat])
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
      point = new BMap.Point(coordinates[0], coordinates[1])
    }
    else {
      let coordinates = this.geometry.coordinates[0][0] // 取区域的第一个点做弹出点
      point = new BMap.Point(coordinates[0], coordinates[1])
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
      lng: coordinates[0],
      lat: coordinates[1]
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
        points
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
    let ps = this.geometry.coordinates[0]
    return ps.map(s => {
      return { lng: s[0], lat: s[1] }
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
        this.emit('stop')
        div.className = 'point-control-option'
        map.setDefaultCursor('url("http://api0.map.bdimg.com/images/openhand.cur") 8 8, default')
        map.enableDragging()
      }
      else {
        this.emit('begin')
        div.className = 'point-control-option active'
        map.setDefaultCursor('crosshair')
        map.disableDragging()
      }
    }
    map.getContainer().appendChild(div)
    addStylesheetRules([
      [
        '.point-control-option',
        ['width', '20px'],
        ['height', '20px'],
        ['cursor', 'pointer'],
        // ['background', 'url(http://image.qiniu.hippor.com/location1.png) center center'],
        ['background', 'url(data:image/png;base64,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) center center'],
        ['background-size', '20px']
      ],
      [
      '.point-control-option.active',
        // ['background', 'url(http://image.qiniu.hippor.com/location2.png) center center'],
        ['background', 'url(data:image/png;base64,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) center center'],
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
        this.emit('stop')
        div.className = 'polygon-control-option'
        map.enableDragging()
      }
      else {
        this.emit('begin')
        div.className = 'polygon-control-option active'
        map.disableDragging()
      }
    }
    map.getContainer().appendChild(div)
    addStylesheetRules([
      [
        '.polygon-control-option',
        ['width', '20px'],
        ['height', '20px'],
        ['cursor', 'pointer'],
        ['background', 'url(data:image/png;base64,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) center center'],
        ['background-size', '20px']
      ],
      [
        '.polygon-control-option.active',
        ['background', 'url(data:image/png;base64,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) center center'],
        ['background-size', '20px']
      ]
    ])
    this.div = div
    return div
  }
  stop() {
    this.div.className = 'polygon-control-option'
  }
  on(eventName, callback) {
    this.events[eventName] = callback
  }
  emit(name, ...args) {
    this.events[name].call(this, args)
  }
}

class AreaControl extends Control {
  constructor(defaultAnchor = window.BMAP_ANCHOR_TOP_RIGHT) {
    super()
    this.defaultAnchor = defaultAnchor
    this.defaultOffset = new BMap.Size(10, 80)
    this.events = {
      begin: function () { },
      stop: function () { }
    }
  }
  initialize(map) {
    let div = document.createElement('div')
    div.className = 'area-control-option'
    let input = document.createElement('input')
    input.setAttribute('type', 'text')
    input.className = 'area-control-input'
    input.setAttribute('placeholder', '请输入区域名称，仅支持到区县')
    div.appendChild(input)
    div.onmouseenter = (e) => {
      input.className = 'area-control-input active'
      setTimeout(() => {
        input.focus()
      }, 400)
    }
    div.onmouseleave = (e) => {
      input.className = 'area-control-input'
    }
    input.onkeyup = (e) => {
      if (e.keyCode === 13 && input.value) {
        this.emit('search', input.value)
      }
    }
    // div.onclick = (e) => {
    //   if (div.className === 'area-control-option active') {
    //     this.emit('stop')
    //     div.className = 'area-control-option'
    //     map.enableDragging()
    //   }
    //   else {
    //     this.emit('begin')
    //     div.className = 'area-control-option active'
    //     map.disableDragging()
    //   }
    // }
    map.getContainer().appendChild(div)
    addStylesheetRules([
      [
        '.area-control-option',
        ['width', '20px'],
        ['height', '20px'],
        ['cursor', 'pointer'],
        ['background', 'url(data:image/png;base64,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) center center'],
        ['background-size', '20px']
      ],
      [
        '.area-control-option.active',
        ['background', 'url(data:image/png;base64,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) center center'],
        ['background-size', '20px']
      ],
      [
        '.area-control-input',
        ['position', 'absolute'],
        ['right', '-300px'],
        ['opacity', '0'],
        ['top', '-10px'],
        ['transition', 'all 0.3s ease'],
        ['width', '170px'],
        ['height', '30px'],
        ['outline', '0']
      ],
      [
        '.area-control-input.active',
        ['position', 'absolute'],
        ['right', '20px'],
        ['opacity', '1'],
        ['top', '-10px'],
        ['transition', 'all 0.3s ease'],
        ['outline', '0']
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
