# bmap-json

> 基于百度地图生成geojson

## 依赖

百度地图

## 使用说明

### 引入方式

传统引入方式：

```html
<script src="http://api.map.baidu.com/getscript?v=3.0&ak=KAYsf1crZqV9xgyWEzsGpaVzvobclAmu&t=1"></script>
<script src="thirdparty/bmap/bmap-geojson.js"></script>
```

ES6引入方式

```shell
npm install BmapGeo
```

```javascript
import { BmapGeo } from 'BmapGeo'
```

### 调用方式

```javascript
var map = new BMap.Map('container')
map.centerAndZoom("北京", 12)
map.enableScrollWheelZoom(true)
var geo = new BmapGeo(map)
geo.showControl() // 显示内置控制图标
geo.on('add', function (type, result) { // 元素被添加触发事件
  console.log(result)
})
geo.on('delete', function (type, result) { // 元素被删除触发事件
  console.log(result)
})
```

### Method

#### showControl()

显示内置绘制控件，目前内置了`绘制区域polygon`控件和`绘制坐标点point`控件

#### open(type)

开始绘制

Parameters

|name|Type|Default|description|
|----|----|-------|-----------|
|open|type|1|绘制的模式，1表示绘制区域polygon，2表示绘制坐标点point。在不调用showControl()时，可以使用这个方法实现自定义绘制控件。|

#### clear()

清除使用后生成的数据，便于重新使用。

#### close()

结束绘制

### Events

- on(eventName, callback)

|eventName|description|
|---------|-----------|
|add|元素被添加触发事件|
|delete|元素被删除触发事件|
|change|元素属性被修改触发，目前只修改name属性|