import { defineConfig } from "vitepress";

export default defineConfig({
  title: "PPZ Plus",
  description: "VS Code 数据库导入导出扩展。",
  base: "/ppz-plus/",
  cleanUrls: true,
  head: [["meta", { name: "theme-color", content: "#3b82f6" }]],
  locales: {
    root: {
      label: "简体中文",
      lang: "zh-CN",
      description: "VS Code 数据库导入导出扩展。",
      themeConfig: {
        nav: [
          { text: "指南", link: "/guide/install" },
          { text: "使用", link: "/guide/usage" },
          { text: "架构", link: "/guide/architecture" },
          { text: "GitHub", link: "https://github.com/xcy960815/ppz-plus" },
        ],
        sidebar: [
          {
            text: "开始使用",
            items: [
              { text: "安装", link: "/guide/install" },
              { text: "使用", link: "/guide/usage" },
              { text: "架构", link: "/guide/architecture" },
            ],
          },
        ],
        socialLinks: [{ icon: "github", link: "https://github.com/xcy960815/ppz-plus" }],
        footer: {
          message: "基于 MIT 协议发布。",
          copyright: "Copyright © xcy960815",
        },
        outlineTitle: "本页目录",
        docFooter: {
          prev: "上一页",
          next: "下一页",
        },
        langMenuLabel: "语言",
        returnToTopLabel: "返回顶部",
        sidebarMenuLabel: "菜单",
        darkModeSwitchLabel: "外观",
        lightModeSwitchTitle: "切换到浅色模式",
        darkModeSwitchTitle: "切换到深色模式",
      },
    },
    en: {
      label: "English",
      lang: "en-US",
      description: "VS Code database import/export extension.",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/en/guide/install" },
          { text: "Usage", link: "/en/guide/usage" },
          { text: "Architecture", link: "/en/guide/architecture" },
          { text: "GitHub", link: "https://github.com/xcy960815/ppz-plus" },
        ],
        sidebar: [
          {
            text: "Getting Started",
            items: [
              { text: "Install", link: "/en/guide/install" },
              { text: "Usage", link: "/en/guide/usage" },
              { text: "Architecture", link: "/en/guide/architecture" },
            ],
          },
        ],
        socialLinks: [{ icon: "github", link: "https://github.com/xcy960815/ppz-plus" }],
        footer: {
          message: "Released under the MIT License.",
          copyright: "Copyright © xcy960815",
        },
        outlineTitle: "On this page",
        docFooter: {
          prev: "Previous page",
          next: "Next page",
        },
        langMenuLabel: "Languages",
        returnToTopLabel: "Return to top",
        sidebarMenuLabel: "Menu",
        darkModeSwitchLabel: "Appearance",
        lightModeSwitchTitle: "Switch to light theme",
        darkModeSwitchTitle: "Switch to dark theme",
      },
    },
  },
});
