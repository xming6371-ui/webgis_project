// 服务器配置文件
export default {
  // 服务器端口
  port: process.env.PORT || 8080,

  // Conda环境配置
  // 如果你的GDAL安装在conda环境中，请设置环境名称
  // 例如：'base', 'xm', 'gis', 'gdal_env' 等
  // 如果GDAL已添加到系统PATH，可设置为 null
  // Docker环境中应设置为 null（GDAL 已在系统层面安装）
  condaEnv: process.env.NODE_ENV === "production" ? null : "py", // 生产环境使用系统GDAL，本地开发使用py环境

  // 数据目录（相对于项目根目录）
  dataDir: "public/data",

  // 元数据文件
  metadataFile: "imageData.json",
};
