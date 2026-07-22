var posts=["2026/07/12/AI-辅助编程实践-效率翻倍的秘密/","2026/07/12/C-STL-常用容器总结/","2026/07/12/Hello-World-0/","2026/07/12/Hexo-Anzhiyu-个人博客搭建全记录/","2026/07/12/C-智能指针完全指南/","2026/07/12/Python-异步编程-async-await-深入理解/","2026/07/12/Claude-Code-终端AI编程助手完全指南/","2026/07/12/Python-爬虫入门指南/","2026/07/12/ROS-机器人开发笔记/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };