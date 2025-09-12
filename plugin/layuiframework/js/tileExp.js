layui.define(["jquery", "layer", "form", "formplus", "tile","dropdown"], function (exports) {

  const KEY = "tileExp";


  var handler = {

    run: function(){

      layui.layer.open({
        id:"2",
        title: '<B>测试</B>',
        offset: "lt",
        anim: "slideLeft",
        area: ["380px","100%"],
        content: `
          <style>
            .docs-icon-area {
              display: inline-block;
              vertical-align: middle;
              width: 80px;
              height: 56px;
              line-height: 25px;
              padding: 20px 0;
              margin-right: 10px;
              margin-bottom: 10px;
              border: 1px solid #e2e2e2;
              font-size: 14px;
              text-align: center;
              color: #777;
              cursor: pointer;
              transition: all .3s;
              -webkit-transition: all .3s;
            }

            .docs-icon-area:hover {
              border-color: rgba(22, 183, 119, 1);
              color: rgba(22, 183, 119, 1);
            }
          </style>
          <div class="layui-fluid">
            <div class="layui-row">
              <div class="layui-card">
                <div class="layui-card-header">表单元素</div>
                <div class="layui-card-body" >
                  <div>
                    <div class = "docs-icon-area" layui-form-content="input">
                      <i class="layui-icon layui-icon-template-1"></i>
                      <div class="docs-icon-name">输入框</div>
                    </div>
                    <div class = "docs-icon-area" layui-form-content="textarea">
                      <i class="layui-icon layui-icon-template-1"></i>
                      <div class="docs-icon-name">文本域</div>
                    </div>
                    <div class = "docs-icon-area" layui-form-content="select">
                      <i class="layui-icon layui-icon-template-1"></i>
                      <div class="docs-icon-name">下拉框</div>
                    </div>
                    <div class = "docs-icon-area" layui-form-content="radio">
                      <i class="layui-icon layui-icon-template-1"></i>
                      <div class="docs-icon-name">单选框</div>
                    </div>
                    <div class = "docs-icon-area" layui-form-content="checkbox">
                      <i class="layui-icon layui-icon-template-1"></i>
                      <div class="docs-icon-name">复选框</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        shade: 0,
        btn: null,
        success: function(layero, index){
          layui.dropdown.render({
            elem: layero.find('.docs-icon-area'),
            trigger: "contextmenu",
            data: [            {
              title: "添加",
              menuType: "add",
              id: "add"
            },{
              title: "取消操作",
              menuType: "cancel",
              id: "cancel"
            }],
            click: function click(obj, othis){

            }
          });
        },
      });

    },

    renderInput: function(option){

    },

  };

  handler.run();
  exports(KEY, handler);

});