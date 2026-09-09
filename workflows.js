
const prompts={
material:`原始场景图 @图片1
目标材质参考图 @图片2

将 @图片1 中凳子木制部分的材质、颜色、纹理，严格替换成 @图片2 中凳子的木质部分的材质、颜色、纹理，@图片1 的其他木制家具的木质部分的材质、颜色替换成 @图片2 中凳子的木制部分的颜色，@图片1 其他内容保持不变`,
object:`请将上传图片中的指定物品替换为新的目标物品。

需要替换的物品：【请输入原物品】
替换为：【请输入目标物品】

保持原物品所在的位置、尺寸比例、透视方向和整体构图关系基本不变。`,
imagePerson:`将所有真实人物替换为明显欧洲血统的白人商业广告人物，以北欧、西欧和白人北美人物为主。肤色以白皙、浅色和自然健康肤色为主。严格保持人物数量不变、只替换图片有的人物。不同人物必须拥有明显不同的脸型、五官比例、年龄感、发型和发色。可使用金发、深金发、草莓金、浅棕发、红棕发和少量深棕发；眼睛可为蓝色、绿色、灰色或浅棕色；可以有雀斑、自然皱纹、不同眉形、鼻形、颧骨和下颌结构。保留原人物性别表达和年龄段。儿童仍为相似年龄儿童，中老年人保留真实年龄感。不同人物必须彼此无血缘感，不得像双胞胎、兄弟姐妹或同一张脸的变体。所有人物均为虚构人物，不得模仿名人。`,
videoPerson:`请将上传视频中的原人物替换为目标人物。

目标人物参考：【请上传人物参考图或输入人物特征】

保持原视频的人物动作、表演节奏、身体姿态、镜头运动、构图和场景内容基本不变。`,
selling:`请根据上传的产品素材生成一段产品卖点展示视频。

产品名称：【请输入产品名称】
核心卖点：【请输入需要重点展示的卖点】
目标使用场景：【请输入场景，可选】`
};

const imageWorkflows=[
{id:"material",name:"材质替换",type:"image",promptKey:"material"},
{id:"object",name:"物品替换",type:"image",promptKey:"object"},
{id:"imagePerson",name:"人物替换",type:"image",promptKey:"imagePerson"},
{id:"background",name:"背景替换",type:"image"},
{id:"scene",name:"场景生成",type:"image"},
{id:"retouch",name:"商品精修",type:"image"},
{id:"style",name:"风格转换",type:"image"},
{id:"inpaint",name:"局部重绘",type:"image"},
{id:"composition",name:"构图扩展",type:"image"},
{id:"poster",name:"商品场景应用",type:"image"}
];

const videoWorkflows=[
{id:"videoPerson",name:"人物替换",type:"video",promptKey:"videoPerson"},
{id:"selling",name:"卖点视频生成",type:"video",promptKey:"selling"},
{id:"productVideo",name:"商品展示视频",type:"video"},
{id:"sceneVideo",name:"场景视频生成",type:"video"},
{id:"img2video",name:"图片转视频",type:"video"},
{id:"camera",name:"运镜生成",type:"video"}
];

