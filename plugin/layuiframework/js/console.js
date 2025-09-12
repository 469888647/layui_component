layui.define(["util", "carousel"], function (exports) {
  let device = layui.device();
  let handler = {
    run: function () {
      handler.layero = $('body');  
      handler.parentLayui = window.parent.layui;
      handler.echartsApp = [];
      handler.echartsIndex = 0;
      handler.initTile();
      handler.initTable();
      handler.addListener();
    },
    initTile: function () {
      let data = [
        {
          id: 1,
          name: "layui",
          source: [
            {
              id: "layui",
              name: "layui官网",
              x: 0,
              y: 0,
              w: 2,
              h: 2,
              img: "../image/icon-1.png",
              kv:{
                url:"https://gitee.com/layui/layui"
              },
            },
            {
              id: "Layuivue",
              name: "Layuivue",
              x: 2,
              y: 0,
              w: 1,
              h: 1,
              bgColor:"#FFFFFF",
              img: "../image/logo-png.a3bc5caf.png",
              kv:{
                url:"http://www.layui-vue.com/zh-CN/index"
              },
            },
            {
              id: "layuiAdmin",
              name: "layuiAdmin",
              x: 2,
              y: 1,
              w: 1,
              h: 1,
              kv:{
                url:"https://dev.layuion.com/themes/layuiadmin/"
              },
            },
          ],
        },
        {
          name: "视频",
          source: [
            {
              id: "video",
              name: "新版本教程",
              x: 0,
              y: 0,
              w: 3,
              h: 2,
              kv:{
                url:"https://b23.tv/PVL0YGx"
              },
              refuseAnimate: true,
              content: "<div id = 'tilePreviewWindow' style = 'width:100%;height:100%' ><div class='layui-card'><div class='layui-card-header'>视频来源互联网</div><div class='layui-card-body'><video autoplay muted width='240'><source src='../resource/1.mp4' type='video/mp4'></video></div></div></div>",
            }
          ]
        }
      ];

      var container = handler.layero.find(".layui-layer-tiles");

      handler.parentLayui.tileInstance = layui
        .tile(container, { data: data , cacheable: true })
        .on('clickTile', function(option){
          if(option.tile.kv.url){
            window.open(option.tile.kv.url, "_target");
          }
        })
        .setAnimate(
          [
            "flip",
            "bounceIn",
            "flash",
            "pulse",
            "rubberBand",
            "shake",
            "headShake",
            "swing",
          ],
          0.5
        ).enableCache().enableAutoCache();
      // 设置默认的点击事件  
      // handler.parentLayui.tileInstance.setClickEvent(function(id){
      //   handler.parentLayui.frame.setTop(id);
      // });
    },
    initTable: function () {
      handler.table = layui.table.render({
        elem: "#layui-framework-table",
        url: "../json/table/demo.json",
        toolbar: "#layui-framework-table-headToolbar",
        defaultToolbar: [
          "filter",
          "exports",
          "print",
          {
            title: "提示",
            layEvent: "LAYTABLE_TIPS",
            icon: "layui-icon-tips",
          },
        ],
        height: "540px",
        page: true,
        cols: [
          [
            { type: "checkbox", fixed: "left" },
            { field: "id", fixed: "left", width: 80, title: "ID" },
            { field: "name", width: 100, title: "待办人" },
            {
              field: "content",
              title: "内容",
              width: 150,
              edit: "textarea",
            },
            {
              field: "status",
              title: "状态",
              width: 100,
              templet: function (d) {
                let map = {
                  1: "已完成",
                  0: "进行中",
                };
                return map[d.status] || d.status;
              },
            },
            {
              field: "progress",
              title: "进度",
              width: 200,
              templet: "#layui-framework-table-progress",
            },
            { field: "starttime", width: 150, title: "计划开始时间" },
            { field: "endtime", width: 150, title: "计划完成时间" },
            { field: "cost", width: 100, title: "耗时" },
            {
              fixed: "right",
              title: "操作",
              width: 134,
              minWidth: 125,
              toolbar: "#layui-framework-table-toolbar",
            },
          ],
        ],
        done: function (res, curr, count) {
          layui.element.render("progress");
          // layui.table 渲染时的 id 属性值
          var id = this.id;
          handler.tableId = id;
          /**
           * 绑定： 头按钮上面的下拉菜单
           */
          layui.dropdown.render({
            elem: "#dropdownButton", // 可绑定在任意元素中，此处以上述按钮为例
            data: [
              {
                id: "add",
                title: "添加",
              },
              {
                id: "update",
                title: "编辑",
              },
              {
                id: "delete",
                title: "删除",
              },
            ],
            // 指定这个下拉菜单各项被（点击）的事件
            click: function (obj) {
              var checkStatus = layui.table.checkStatus(id);
              var data = checkStatus.data; // 获取选中的数据
              handler.tableTitleEvent[obj.id] &&
                handler.tableTitleEvent[obj.id](data);
            },
          });

          /**
           * 绑定： 头按钮上面的下拉菜单
           */
          layui.dropdown.render({
            elem: "#rowMode",
            data: [
              {
                id: "defaultRow",
                title: "单行模式（默认）",
              },
              {
                id: "multiRow",
                title: "多行模式",
              },
            ],
            // 菜单被点击的事件
            click: function (obj) {
              handler.tableTitleEvent[obj.id] &&
                handler.tableTitleEvent[obj.id](id);
            },
          });
        },
        error: function (res, msg) {
          console.log(res, msg);
        },
      });
    },
    renderDataView: function (index) {
      handler.carouselIndex = index;
      handler.echartsApp[index].setOption(options[index], true, false);
      handler.echartsApp[index].resize();
    },
    addListener: function () {
      layui.util.event("layui-framework-event", {
        tile: function () {
          //  TODO 跳转磁贴介绍页
        },
        tileReset: function(){
          // handler.parentLayui.tile.resetAllData();


          layui.data('windowsTile', null);
          layui.layer.msg('操作成功,请重新加载主页!', {icon: 6});
        },
        table: function () {
          // TODO  介绍layui的table
          // let htmlStr = "";
          // handler.parentLayui.layer.open({
          //   type: 1,
          //   title: "鱼聪明",
          //   offset: "r",
          //   anim: "slideLeft", // 从右往左
          //   area: ["320px", "100%"],
          //   shade: 0.1,
          //   shadeClose: true,
          //   id: "layui-framework-bi",
          //   content: "sasas",
          // });
        },
      });

      /**
       * table头部菜单的下拉菜单的点击事件合集
       */
      handler.tableTitleEvent = {
        add: function () {
          handler.parentLayui.layer.open({
            type: 1,
            title: "添加记录",
            offset: "r",
            anim: "slideLeft", // 从右往左
            area: ["320px", "100%"],
            shade: 0.1,
            shadeClose: true,
            id: "layui-framework-tableTitleEvent-add",
            content:
              "<div>当前展示以弹出层的方式进行添加操作,除此之外还可以使用iframe的方式实现<div>",
          });
        },
        update: function (data) {
          if (data.length !== 1)
            return layui.layer.msg("请选择一行", { icon: 5 });
          handler.parentLayui.layer.open({
            type: 1,
            title: "修改记录",
            offset: "r",
            anim: "slideLeft", // 从右往左
            area: ["320px", "100%"],
            shade: 0.1,
            shadeClose: true,
            id: "layui-framework-tableTitleEvent-update",
            content:
              "<div>当前展示以弹出层的方式进行修改操作,除此之外还可以使用iframe的方式实现</div><h4>传入的数据有:</h4><div id = 'layui-framework-tableTitleEvent-update-data'></div>",
            success: function (layero) {
              layero
                .find("#layui-framework-tableTitleEvent-update-data")
                .text(JSON.stringify(data));
            },
          });
        },
        delete: function (data) {
          if (data.length !== 1)
            return layui.layer.msg("请选择一行", { icon: 5 });
          layui.layer.confirm(
            "您确认删除该记录吗？",
            function (index) {
              layui.layer.msg("删除成功!", { icon: 6 });
            },
            function (index) {
              layui.layer.close(index);
            }
          );
        },
        defaultRow: function (id) {
          layui.table.reload(id, {
            lineStyle: null, // 恢复单行
          });
          layui.layer.msg("已设为单行", { icon: 6 });
        },
        multiRow: function (id) {
          layui.table.reload(id, {
            // 设置行样式，此处以设置多行高度为例。若为单行，则没必要设置改参数 - 注：v2.7.0 新增
            lineStyle: "height: 95px;",
          });
          layui.layer.msg("即通过设置 lineStyle 参数可开启多行", { icon: 6 });
        },
        getCheckData: function(id){
          var checkStatus = layui.table.checkStatus(id);
          var data = checkStatus.data;
          layer.alert(layui.util.escape(JSON.stringify(data)));
        },
        getData: function(id){
          var getData = layui.table.getData(id);
          layer.alert(layui.util.escape(JSON.stringify(getData)));
        },
        'LAYTABLE_TIPS': function(id){
          layer.alert('自定义工具栏图标按钮,id:'+id);
        },
        edit: function(obj){
          var data = obj.data;
          layui.layer.open({
            title: '编辑 - id:'+ data.id,
            type: 1,
            area: ['80%','80%'],
            content: '<div style="padding: 16px;">自定义表单元素:'+ JSON.stringify(data)+'</div>'
          });
        },
        more: function(obj){
          var data = obj.data;
          layui.dropdown.render({
            elem: this, // 触发事件的 DOM 对象
            show: true, // 外部事件触发即显示
            data: [{
              title: '查看',
              id: 'detail'
            },{
              title: '删除',
              id: 'del'
            }],
            click: function(menudata){
              if(menudata.id === 'detail'){
                layer.msg('查看操作，当前行 ID:'+ data.id);
              } else if(menudata.id === 'del'){
                layer.confirm('真的删除行 [id: '+ data.id +'] 么', function(index){
                  obj.del(); // 删除对应行（tr）的DOM结构
                  layui.layer.close(index);
                  // 向服务端发送删除指令
                });
              }
            },
            align: 'right', // 右对齐弹出
            style: 'box-shadow: 1px 1px 10px rgb(0 0 0 / 12%);' // 设置额外样式
          })
        },
      };

      layui.table.on('toolbar(layui-framework-table)', function(obj){
        var id = obj.config.id;
        handler.tableTitleEvent[obj.event] && handler.tableTitleEvent[obj.event](id);
      });

      layui.table.on('tool(layui-framework-table)', function(obj){
        handler.tableTitleEvent[obj.event] && handler.tableTitleEvent[obj.event].call(this, obj);
      });

    },
    resize: function () {
      // 刷新table
      layui.table.reload(handler.tableId);
    },
  };

  handler.run();

  exports("console", handler);
});
