// ==UserScript==
// @name         国内必应自动搜索（修复手机版）
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  修复手机浏览器卡住问题和控制面板不显示问题，确保搜索流程连贯
// @author       Your Name
// @match        https://cn.bing.com/*
// @icon         https://cn.bing.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      top.baidu.com
// @connect      rebang.today
// @connect      ranks.hao.360.com
// ==/UserScript==

(function() {
    'use strict';

    // 全局状态变量
    let isRunning = false;
    let isPaused = false;
    let countdownInterval = null;
    let currentSearchCount = 0;
    let totalSearches = 0;
    let hotWords = [];
    let deviceType = '';
    let sessionTotalSearches = 0;
    let isFirstSearch = true;
    let hotWordFetchTimeout = null;
    let scrollInterval = null;

    // 创建控制面板 - 优化手机端显示位置和大小
    function createControlPanel() {
        // 先移除已存在的面板
        const existingPanel = document.getElementById('autoSearchControlPanel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.style.position = 'fixed';
        panel.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        panel.style.border = '1px solid #ccc';
        panel.style.borderRadius = '8px';
        panel.style.padding = '15px';
        panel.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)';
        panel.style.zIndex = '999999';
        panel.id = 'autoSearchControlPanel';

        // 检测设备类型，调整面板大小和位置
        const isMobile = detectDeviceType() === 'mobile';
        if (isMobile) {
            // 手机端：占满屏幕宽度的90%，居中显示
            panel.style.width = '90%';
            panel.style.left = '5%';
            panel.style.top = '50%';
            panel.style.transform = 'translateY(-50%)';
            panel.style.maxHeight = '80vh';
            panel.style.overflowY = 'auto';
        } else {
            // PC端：固定宽度，右上角显示
            panel.style.width = '280px';
            panel.style.right = '20px';
            panel.style.top = '20px';
        }

        // 标题
        const title = document.createElement('h3');
        title.textContent = '必应自动搜索控制';
        title.style.margin = '0 0 15px 0';
        title.style.fontSize = '18px';
        title.style.textAlign = 'center';
        title.style.color = '#333';
        panel.appendChild(title);

        // 状态显示
        const statusDiv = document.createElement('div');
        statusDiv.id = 'autoSearchStatus';
        statusDiv.style.margin = '0 0 15px 0';
        statusDiv.style.padding = '12px';
        statusDiv.style.backgroundColor = '#f5f5f5';
        statusDiv.style.borderRadius = '6px';
        statusDiv.style.textAlign = 'center';
        statusDiv.style.fontSize = '16px';
        statusDiv.style.fontWeight = 'bold';
        statusDiv.style.color = '#555';
        statusDiv.textContent = '未运行';
        panel.appendChild(statusDiv);

        // 进度显示
        const progressDiv = document.createElement('div');
        progressDiv.id = 'autoSearchProgress';
        progressDiv.style.margin = '0 0 15px 0';
        progressDiv.style.textAlign = 'center';
        progressDiv.style.fontSize = '15px';
        progressDiv.style.color = '#666';
        progressDiv.textContent = '进度: 0/0';
        panel.appendChild(progressDiv);

        // 按钮容器
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.gap = '10px';
        buttonsDiv.style.justifyContent = 'center';

        // 开始按钮
        const startBtn = document.createElement('button');
        startBtn.id = 'startSearchBtn';
        startBtn.textContent = '开始搜索';
        startBtn.style.padding = '8px 16px';
        startBtn.style.backgroundColor = '#4CAF50';
        startBtn.style.color = 'white';
        startBtn.style.border = 'none';
        startBtn.style.borderRadius = '6px';
        startBtn.style.cursor = 'pointer';
        startBtn.style.fontSize = '14px';
        startBtn.style.fontWeight = 'bold';
        startBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        startBtn.style.transition = 'all 0.2s ease';
        startBtn.addEventListener('mouseover', () => startBtn.style.transform = 'translateY(-2px)');
        startBtn.addEventListener('mouseout', () => startBtn.style.transform = 'translateY(0)');
        startBtn.addEventListener('click', startSearch);
        buttonsDiv.appendChild(startBtn);

        // 暂停按钮
        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'pauseSearchBtn';
        pauseBtn.textContent = '暂停';
        pauseBtn.style.padding = '8px 16px';
        pauseBtn.style.backgroundColor = '#ff9800';
        pauseBtn.style.color = 'white';
        pauseBtn.style.border = 'none';
        pauseBtn.style.borderRadius = '6px';
        pauseBtn.style.cursor = 'pointer';
        pauseBtn.style.fontSize = '14px';
        pauseBtn.style.fontWeight = 'bold';
        pauseBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        pauseBtn.style.transition = 'all 0.2s ease';
        pauseBtn.disabled = true;
        pauseBtn.addEventListener('mouseover', () => !pauseBtn.disabled && (pauseBtn.style.transform = 'translateY(-2px)'));
        pauseBtn.addEventListener('mouseout', () => !pauseBtn.disabled && (pauseBtn.style.transform = 'translateY(0)'));
        pauseBtn.addEventListener('click', togglePause);
        buttonsDiv.appendChild(pauseBtn);

        // 结束按钮
        const stopBtn = document.createElement('button');
        stopBtn.id = 'stopSearchBtn';
        stopBtn.textContent = '结束';
        stopBtn.style.padding = '8px 16px';
        stopBtn.style.backgroundColor = '#f44336';
        stopBtn.style.color = 'white';
        stopBtn.style.border = 'none';
        stopBtn.style.borderRadius = '6px';
        stopBtn.style.cursor = 'pointer';
        stopBtn.style.fontSize = '14px';
        stopBtn.style.fontWeight = 'bold';
        stopBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        stopBtn.style.transition = 'all 0.2s ease';
        stopBtn.disabled = true;
        stopBtn.addEventListener('mouseover', () => !stopBtn.disabled && (stopBtn.style.transform = 'translateY(-2px)'));
        stopBtn.addEventListener('mouseout', () => !stopBtn.disabled && (stopBtn.style.transform = 'translateY(0)'));
        stopBtn.addEventListener('click', stopSearch);
        buttonsDiv.appendChild(stopBtn);

        panel.appendChild(buttonsDiv);
        document.body.appendChild(panel);

        // 确保面板可见
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 更新状态显示
    function updateStatus(text) {
        const statusDiv = document.getElementById('autoSearchStatus');
        if (statusDiv) {
            statusDiv.textContent = text;

            // 根据状态设置不同颜色
            if (text.includes('运行中') || text.includes('搜索中') || text.includes('等待')) {
                statusDiv.style.backgroundColor = '#e8f5e9';
                statusDiv.style.color = '#2e7d32';
            } else if (text.includes('已暂停')) {
                statusDiv.style.backgroundColor = '#fff8e1';
                statusDiv.style.color = '#ff8f00';
            } else if (text.includes('已停止') || text.includes('未运行')) {
                statusDiv.style.backgroundColor = '#ffebee';
                statusDiv.style.color = '#c62828';
            } else if (text.includes('完成')) {
                statusDiv.style.backgroundColor = '#e3f2fd';
                statusDiv.style.color = '#1565c0';
            } else {
                statusDiv.style.backgroundColor = '#f5f5f5';
                statusDiv.style.color = '#555';
            }
        }
    }

    // 更新进度显示
    function updateProgress(current, total) {
        const progressDiv = document.getElementById('autoSearchProgress');
        if (progressDiv) {
            progressDiv.textContent = `进度: ${current}/${total}`;
            localStorage.setItem('bingAutoSearchProgress', JSON.stringify({
                current: current,
                total: total,
                timestamp: new Date().getTime()
            }));
        }
    }

    // 检测设备类型
    function detectDeviceType() {
        const userAgent = navigator.userAgent;
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        return mobileRegex.test(userAgent) ? 'mobile' : 'pc';
    }

    // 热词智能精简处理
    function optimizeHotWord(word) {
        let optimized = word.trim().replace(/^[【】()（）[]]+|[【】()（）[]]+$/g, '');

        const separators = /[，,。.？?！!：:;；—-]/;
        if (separators.test(optimized)) {
            const parts = optimized.split(separators);
            optimized = parts[0].trim();
        }

        const maxLength = deviceType === 'pc' ? 12 : 10;
        const minLength = deviceType === 'pc' ? 3 : 2;

        if (optimized.length > maxLength) {
            const cutPoints = [
                optimized.lastIndexOf(' ', maxLength),
                optimized.lastIndexOf('，', maxLength),
                optimized.lastIndexOf('的', maxLength)
            ].filter(pos => pos > minLength);

            const cutPos = cutPoints.length > 0 ? Math.max(...cutPoints) : maxLength;
            optimized = optimized.substring(0, cutPos).trim();
        }

        if (optimized.length < minLength) {
            optimized = word.trim().substring(0, maxLength).trim();
        }

        return optimized;
    }

    // 从百度热榜获取PC端热词
    function getPcHotWords() {
        return new Promise((resolve, reject) => {
            const hotListUrl = 'https://top.baidu.com/board?tab=realtime';

            GM_xmlhttpRequest({
                method: 'GET',
                url: hotListUrl,
                timeout: 10000, // 10秒超时
                onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const hotWordElements = doc.querySelectorAll('.c-single-text-ellipsis');

                        let hotWords = Array.from(hotWordElements)
                            .map(el => el.textContent.trim())
                            .filter(word => word.length > 0)
                            .map(word => optimizeHotWord(word))
                            .filter(word => word.length >= 3);

                        if (hotWords.length < 40) {
                            console.log(`百度热榜仅获取到${hotWords.length}条有效热词，补充至40条`);
                            while (hotWords.length < 40) {
                                hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 40 - hotWords.length)));
                            }
                        } else {
                            hotWords = hotWords.slice(0, 40);
                        }

                        resolve(hotWords);
                    } catch (e) {
                        console.error('解析百度热榜失败:', e);
                        resolve(getFallbackPcWords());
                    }
                },
                onerror: function(error) {
                    console.error('获取百度热榜失败:', error);
                    resolve(getFallbackPcWords());
                },
                ontimeout: function() {
                    console.error('获取百度热榜超时');
                    resolve(getFallbackPcWords());
                }
            });
        });
    }

    // 从今日头条API获取移动端热词
    function getMobileHotWords() {
        return new Promise((resolve) => {
            const hotListUrl = 'https://api.rebang.today/v1/items?tab=top&sub_tab=lasthour&page=1&version=1';

            GM_xmlhttpRequest({
                method: 'GET',
                url: hotListUrl,
                timeout: 10000, // 10秒超时
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                onload: function(response) {
                    try {
                        const result = JSON.parse(response.responseText);

                        if (result.code !== 200 || !result.data || !result.data.list) {
                            console.error('今日头条API返回异常:', result);
                            return resolve(getFallbackMobileWords());
                        }

                        let items;
                        try {
                            items = JSON.parse(result.data.list);
                        } catch (e) {
                            console.error('解析今日头条list数据失败:', e);
                            return resolve(getFallbackMobileWords());
                        }

                        let hotWords = items
                            .filter(item => item && item.title && item.title.trim().length > 0)
                            .map(item => optimizeHotWord(item.title))
                            .filter(word => word.length >= 2);

                        if (hotWords.length < 30) {
                            console.log(`今日头条仅获取到${hotWords.length}条有效热词，补充至30条`);
                            while (hotWords.length < 30) {
                                hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 30 - hotWords.length)));
                            }
                        } else {
                            hotWords = hotWords.slice(0, 30);
                        }

                        resolve(hotWords);
                    } catch (e) {
                        console.error('解析今日头条热榜失败:', e);
                        resolve(getFallbackMobileWords());
                    }
                },
                onerror: function(error) {
                    console.error('获取今日头条热榜失败:', error);
                    resolve(getFallbackMobileWords());
                },
                ontimeout: function() {
                    console.error('获取今日头条热榜超时');
                    resolve(getFallbackMobileWords());
                }
            });
        });
    }

    // PC端备用热词
    function getFallbackPcWords() {
        return [
            "人工智能发展", "全球经济趋势", "量子计算突破", "新能源技术", "元宇宙应用",
            "区块链创新", "5G技术进展", "太空探索", "自动驾驶", "大数据分析",
            "云计算发展", "网络安全动态", "机器学习", "边缘计算", "数字货币",
            "生物科技", "虚拟现实", "增强现实", "物联网", "智能家居"
        ];
    }

    // 移动端备用热词
    function getFallbackMobileWords() {
        return [
            "手机新品", "短视频挑战", "移动游戏排行", "手机摄影", "流量套餐",
            "手游攻略", "移动支付安全", "短视频制作", "手机评测", "充电宝选购",
            "社交软件", "网络热点", "明星动态", "电影推荐", "美食做法",
            "旅游攻略", "健康养生", "学习技巧", "职场经验", "亲子教育"
        ];
    }

    // 随机生成延迟时间
    function getRandomDelay() {
        return Math.floor(Math.random() * 13) + 3; // 3-15秒
    }

    // 随机选择热词并从列表中移除，避免重复
    function getRandomItemAndRemove(arr) {
        if (!arr || arr.length === 0) return null;

        const index = Math.floor(Math.random() * arr.length);
        const item = arr[index];
        arr.splice(index, 1);

        if (arr.length === 0) {
            console.log("热词已用尽，重新获取热词");
            if (deviceType === 'pc') {
                getRandomPcHotWords().then(words => hotWords = words);
            } else {
                getRandomMobileHotWords().then(words => hotWords = words);
            }
        }

        return item;
    }

    // 模拟浏览行为
    function simulateBrowsing() {
        return new Promise(resolve => {
            if (scrollInterval) {
                clearInterval(scrollInterval);
                scrollInterval = null;
            }

            if (isPaused || !isRunning) {
                resolve();
                return;
            }

            if (Math.random() < 0.3) {
                updateStatus("正在浏览页面...");
                const scrollTimes = Math.floor(Math.random() * 3) + 1;
                let scrollCount = 0;

                const scrollTimeout = setTimeout(() => {
                    console.log("滑动超时，强制结束浏览");
                    clearInterval(scrollInterval);
                    scrollInterval = null;
                    resolve();
                }, 10000);

                scrollInterval = setInterval(() => {
                    if (isPaused || !isRunning || scrollCount >= scrollTimes) {
                        clearInterval(scrollInterval);
                        clearTimeout(scrollTimeout);
                        scrollInterval = null;
                        setTimeout(resolve, Math.floor(Math.random() * 1500) + 500);
                        return;
                    }

                    const maxScroll = Math.max(
                        document.body.scrollHeight,
                        document.body.offsetHeight,
                        document.documentElement.clientHeight,
                        document.documentElement.scrollHeight,
                        document.documentElement.offsetHeight
                    );

                    const minSafeScroll = Math.max(0, maxScroll * 0.05);
                    const maxSafeScroll = Math.max(0, maxScroll * 0.85);
                    const scrollPosition = Math.floor(minSafeScroll + Math.random() * (maxSafeScroll - minSafeScroll));

                    window.scrollTo({
                        top: scrollPosition,
                        behavior: 'smooth'
                    });

                    scrollCount++;
                }, Math.floor(Math.random() * 1000) + 800);
            } else {
                resolve();
            }
        });
    }

    // 微博热搜接口
    function getWeiboHotWords() {
        return new Promise((resolve) => {
            const hotListUrl = 'https://api.rebang.today/v1/items?tab=top&sub_tab=lasthour&page=1&version=1';

            GM_xmlhttpRequest({
                method: 'GET',
                url: hotListUrl,
                timeout: 10000,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                onload: function(response) {
                    try {
                        const result = JSON.parse(response.responseText);

                        if (result.code !== 200 || !result.data || !result.data.list) {
                            console.error('微博API返回异常:', result);
                            return resolve([]);
                        }

                        let items;
                        try {
                            items = JSON.parse(result.data.list);
                        } catch (e) {
                            console.error('解析微博list数据失败:', e);
                            return resolve([]);
                        }

                        let hotWords = items
                            .filter(item => item && item.title && item.title.trim().length > 0)
                            .map(item => optimizeHotWord(item.title))
                            .filter(word => word.length >= 3);

                        if (hotWords.length < 40) {
                            while (hotWords.length < 40) {
                                hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 40 - hotWords.length)));
                            }
                        } else {
                            hotWords = hotWords.slice(0, 40);
                        }
                        resolve(hotWords);
                    } catch (e) {
                        console.error('解析微博热榜失败:', e);
                        resolve([]);
                    }
                },
                onerror: function() {
                    resolve([]);
                },
                ontimeout: function() {
                    console.error('获取微博热榜超时');
                    resolve([]);
                }
            });
        });
    }

    // 36氪热搜接口
    function get36krHotWords() {
        return new Promise((resolve) => {
            const hotListUrl = 'https://api.rebang.today/v1/items?tab=36kr&sub_tab=hotlist&page=1&version=1';

            GM_xmlhttpRequest({
                method: 'GET',
                url: hotListUrl,
                timeout: 10000,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                onload: function(response) {
                    try {
                        const result = JSON.parse(response.responseText);

                        if (result.code !== 200 || !result.data || !result.data.list) {
                            console.error('36氪API返回异常:', result);
                            return resolve([]);
                        }

                        let items;
                        try {
                            items = JSON.parse(result.data.list);
                        } catch (e) {
                            console.error('解析36氪list数据失败:', e);
                            return resolve([]);
                        }

                        let hotWords = items
                            .filter(item => item && item.title && item.title.trim().length > 0)
                            .map(item => optimizeHotWord(item.title))
                            .filter(word => word.length >= 2);

                        if (hotWords.length < 30) {
                            while (hotWords.length < 30) {
                                hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 30 - hotWords.length)));
                            }
                        } else {
                            hotWords = hotWords.slice(0, 30);
                        }
                        resolve(hotWords);
                    } catch (e) {
                        console.error('解析36氪热榜失败:', e);
                        resolve([]);
                    }
                },
                onerror: function() {
                    resolve([]);
                },
                ontimeout: function() {
                    console.error('获取36氪热榜超时');
                    resolve([]);
                }
            });
        });
    }

    // 修改热词获取逻辑
    async function getRandomPcHotWords() {
        try {
            const sources = [getPcHotWords, getWeiboHotWords];
            const idx = Math.random() < 0.5 ? 0 : 1;
            let words = await Promise.race([
                sources[idx](),
                new Promise(resolve => setTimeout(() => resolve([]), 12000))
            ]);
            if (!words || words.length === 0) {
                words = await Promise.race([
                    sources[1 - idx](),
                    new Promise(resolve => setTimeout(() => resolve([]), 12000))
                ]);
            }
            return words.length > 0 ? words : getFallbackPcWords();
        } catch (e) {
            console.error('获取PC热词出错:', e);
            return getFallbackPcWords();
        }
    }

    async function getRandomMobileHotWords() {
        try {
            const sources = [getMobileHotWords, get36krHotWords];
            const idx = Math.random() < 0.5 ? 0 : 1;
            let words = await Promise.race([
                sources[idx](),
                new Promise(resolve => setTimeout(() => resolve([]), 12000))
            ]);
            if (!words || words.length === 0) {
                words = await Promise.race([
                    sources[1 - idx](),
                    new Promise(resolve => setTimeout(() => resolve([]), 12000))
                ]);
            }
            return words.length > 0 ? words : getFallbackMobileWords();
        } catch (e) {
            console.error('获取移动热词出错:', e);
            return getFallbackMobileWords();
        }
    }

    // 执行搜索
    function performSearch(query) {
        if (isPaused || !isRunning) return;
        if (!query || query.trim().length === 0) {
            console.error("无效的搜索词，跳过本次搜索");
            updateStatus("搜索词无效，准备下一次");
            setTimeout(performSearchCycle, 2000);
            return;
        }
        let searchBoxAttempts = 0;
        const maxAttempts = 5;
        const searchBoxInterval = setInterval(() => {
            const searchBox = document.getElementById('sb_form_q');
            searchBoxAttempts++;
            if (searchBox) {
                clearInterval(searchBoxInterval);
                updateStatus(`搜索中: ${query}`);
                searchBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    searchBox.value = '';
                    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                    searchBox.dispatchEvent(new Event('change', { bubbles: true }));
                    let i = 0;
                    const typeInterval = setInterval(() => {
                        if (!isRunning || isPaused) {
                            clearInterval(typeInterval);
                            return;
                        }
                        if (i < query.length) {
                            searchBox.value += query[i];
                            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                            searchBox.dispatchEvent(new Event('change', { bubbles: true }));
                            searchBox.dispatchEvent(new Event('keydown', {
                                bubbles: true,
                                key: query[i]
                            }));
                            i++;
                        } else {
                            clearInterval(typeInterval);
                            searchBox.focus();
                            setTimeout(() => {
                                if (!isRunning || isPaused) return;
                                const currentState = {
                                    isRunning: isRunning,
                                    currentSearchCount: currentSearchCount,
                                    totalSearches: totalSearches,
                                    isFirstSearch: false
                                };
                                localStorage.setItem('bingAutoSearchState', JSON.stringify(currentState));

                                if (detectDeviceType() === 'mobile') {
                                    const form = document.getElementById('sb_form');
                                    if (form) {
                                        form.submit();
                                    } else {
                                        const enterEvent = new KeyboardEvent('keydown', {
                                            key: 'Enter',
                                            code: 'Enter',
                                            keyCode: 13,
                                            which: 13,
                                            bubbles: true
                                        });
                                        searchBox.dispatchEvent(enterEvent);
                                    }
                                    setTimeout(() => {
                                        simulateSearchResultsBrowsing().then(() => {
                                            setTimeout(performSearchCycle, 1200);
                                        });
                                    }, 2000);
                                } else {
                                    // PC端优先点击搜索按钮
                                    const searchBtn = document.getElementById('sb_form_go');
                                    if (searchBtn) {
                                        searchBtn.click();
                                    } else {
                                        const enterEvent = new KeyboardEvent('keydown', {
                                            key: 'Enter',
                                            code: 'Enter',
                                            keyCode: 13,
                                            which: 13,
                                            bubbles: true
                                        });
                                        searchBox.dispatchEvent(enterEvent);
                                    }
                                    setTimeout(performSearchCycle, 1500);
                                }
                            }, Math.floor(Math.random() * 1500) + 500);
                        }
                    }, Math.floor(Math.random() * 150) + 50);
                }, 500);
            } else if (searchBoxAttempts >= maxAttempts) {
                clearInterval(searchBoxInterval);
                const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
                const currentState = {
                    isRunning: isRunning,
                    currentSearchCount: currentSearchCount,
                    totalSearches: totalSearches,
                    isFirstSearch: false
                };
                localStorage.setItem('bingAutoSearchState', JSON.stringify(currentState));
                window.location.href = searchUrl;

                if (detectDeviceType() === 'mobile') {
                    setTimeout(() => {
                        simulateSearchResultsBrowsing().then(() => {
                            setTimeout(performSearchCycle, 1200);
                        });
                    }, 3000);
                } else {
                    setTimeout(performSearchCycle, 2000);
                }
            }
        }, 500);
    }

    // 搜索循环
    async function performSearchCycle() {
        const savedState = localStorage.getItem('bingAutoSearchState');
        if (savedState) {
            const { isRunning: savedRunning, currentSearchCount: savedCount, totalSearches: savedTotal } = JSON.parse(savedState);
            if (savedRunning && !isRunning) {
                isRunning = true;
                currentSearchCount = savedCount;
                totalSearches = savedTotal;
                sessionTotalSearches = savedTotal;

                document.getElementById('startSearchBtn').disabled = true;
                document.getElementById('pauseSearchBtn').disabled = false;
                document.getElementById('stopSearchBtn').disabled = false;
            }
        }

        if (!isRunning || isPaused) return;

        if (currentSearchCount >= totalSearches) {
            updateStatus(`已完成所有${totalSearches}次搜索`);
            stopSearch();
            alert(`已完成所有${totalSearches}次搜索任务！`);
            return;
        }

        const delaySeconds = getRandomDelay();
        console.log(`第${currentSearchCount + 1}次搜索将在${delaySeconds}秒后进行`);
        updateStatus(`运行中 - 下次搜索: ${delaySeconds}秒`);

        let remaining = delaySeconds;
        if (countdownInterval) clearInterval(countdownInterval);

        let lastCountdownUpdate = Date.now();
        countdownInterval = setInterval(() => {
            if (Date.now() - lastCountdownUpdate > 5000) {
                console.log("倒计时卡住，重置倒计时");
                clearInterval(countdownInterval);
                performSearchCycle();
                return;
            }

            if (!isRunning || isPaused) {
                clearInterval(countdownInterval);
                return;
            }

            updateStatus(`运行中 - 下次搜索: ${remaining}秒`);
            lastCountdownUpdate = Date.now();
            remaining--;

            if (remaining < 0) {
                clearInterval(countdownInterval);
                setTimeout(() => {
                    if (isRunning && !isPaused) {
                        executeNextSearchStep();
                    }
                }, 100);
            }
        }, 1000);

        await new Promise(resolve => {
            if (isPaused || !isRunning) {
                resolve();
                return;
            }
            const waitTime = Math.floor(delaySeconds * 1000 * 0.6);
            const timeoutId = setTimeout(resolve, waitTime);

            const safetyCheck = setInterval(() => {
                if (remaining <= 0 || !isRunning || isPaused) {
                    clearTimeout(timeoutId);
                    clearInterval(safetyCheck);
                    resolve();
                }
            }, 1000);
        });

        if (isPaused || !isRunning) return;

        await simulateBrowsing();
        if (isPaused || !isRunning) return;

        await new Promise(resolve => {
            if (isPaused || !isRunning) {
                resolve();
                return;
            }
            const waitTime = Math.floor(delaySeconds * 1000 * 0.4);
            const timeoutId = setTimeout(resolve, waitTime);

            const safetyCheck = setInterval(() => {
                if (remaining <= 0 || !isRunning || isPaused) {
                    clearTimeout(timeoutId);
                    clearInterval(safetyCheck);
                    resolve();
                }
            }, 1000);
        });

        if (isPaused || !isRunning) return;

        executeNextSearchStep();
    }

    // 执行下一步搜索 - 修复变量名拼写错误
    function executeNextSearchStep() {
        if (!isRunning || isPaused) return;

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        const randomWord = getRandomItemAndRemove(hotWords);
        currentSearchCount++;
        // 修复变量名拼写错误 totalSearchs -> totalSearches
        updateProgress(currentSearchCount, totalSearches);
        performSearch(randomWord);
    }

    // 开始搜索
    async function startSearch() {
        if (isRunning) return;
        isRunning = true;
        isPaused = false;
        isFirstSearch = true;

        const startBtn = document.getElementById('startSearchBtn');
        const pauseBtn = document.getElementById('pauseSearchBtn');
        const stopBtn = document.getElementById('stopSearchBtn');

        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        pauseBtn.style.transform = 'scale(1.05)';
        pauseBtn.style.boxShadow = '0 3px 8px rgba(255, 152, 0, 0.3)';
        updateStatus("准备中...");

        deviceType = detectDeviceType();
        console.log(`设备类型: ${deviceType}`);

        clearTimeout(hotWordFetchTimeout);
        hotWordFetchTimeout = setTimeout(() => {
            if (isRunning && (hotWords === null || hotWords.length === 0)) {
                console.error('热词获取超时，使用备用热词');
                hotWords = deviceType === 'pc' ? getFallbackPcWords() : getFallbackMobileWords();
                initializeSearchProcess();
            }
        }, 20000);

        try {
            if (deviceType === 'pc') {
                totalSearches = 40;
                hotWords = await getRandomPcHotWords();
            } else {
                totalSearches = 30;
                hotWords = await getRandomMobileHotWords();
            }

            clearTimeout(hotWordFetchTimeout);
            initializeSearchProcess();
        } catch (e) {
            clearTimeout(hotWordFetchTimeout);
            updateStatus("热词获取失败，使用备用方案");
            hotWords = deviceType === 'pc' ? getFallbackPcWords() : getFallbackMobileWords();
            initializeSearchProcess();
        }

        function initializeSearchProcess() {
            if (!hotWords || hotWords.length === 0) {
                updateStatus("热词获取失败，请检查网络");
                isRunning = false;
                startBtn.disabled = false;
                pauseBtn.disabled = true;
                stopBtn.disabled = true;
                return;
            }

            sessionTotalSearches = totalSearches;

            const savedProgress = localStorage.getItem('bingAutoSearchProgress');
            if (savedProgress) {
                const { current, total } = JSON.parse(savedProgress);
                if (total === totalSearches) {
                    currentSearchCount = current;
                } else {
                    currentSearchCount = 0;
                }
            } else {
                currentSearchCount = 0;
            }

            if (currentSearchCount >= totalSearches) {
                currentSearchCount = 0;
            }

            updateProgress(currentSearchCount, totalSearches);

            localStorage.setItem('bingAutoSearchState', JSON.stringify({
                isRunning: isRunning,
                currentSearchCount: currentSearchCount,
                totalSearches: totalSearches,
                isFirstSearch: isFirstSearch
            }));

            updateStatus("开始搜索流程");
            setTimeout(performSearchCycle, 1000);
        }
    }

    // 暂停/继续
    function togglePause() {
        if (!isRunning) return;

        isPaused = !isPaused;
        const pauseBtn = document.getElementById('pauseSearchBtn');

        localStorage.setItem('bingAutoSearchState', JSON.stringify({
            isRunning: isRunning,
            currentSearchCount: currentSearchCount,
            totalSearches: totalSearches,
            isFirstSearch: isFirstSearch
        }));

        if (isPaused) {
            if (countdownInterval) clearInterval(countdownInterval);
            if (scrollInterval) clearInterval(scrollInterval);
            pauseBtn.textContent = '继续';
            pauseBtn.style.backgroundColor = '#4caf50';
            pauseBtn.style.boxShadow = '0 3px 8px rgba(76, 175, 80, 0.3)';
            updateStatus("已暂停");
        } else {
            pauseBtn.textContent = '暂停';
            pauseBtn.style.backgroundColor = '#ff9800';
            pauseBtn.style.boxShadow = '0 3px 8px rgba(255, 152, 0, 0.3)';
            updateStatus("继续搜索流程");
            performSearchCycle();
        }
    }

    // 停止搜索 - 新增面板关闭功能
    function stopSearch() {
        isRunning = false;
        isPaused = false;
        if (countdownInterval) clearInterval(countdownInterval);
        if (scrollInterval) clearInterval(scrollInterval);
        clearTimeout(hotWordFetchTimeout);

        localStorage.removeItem('bingAutoSearchState');

        const startBtn = document.getElementById('startSearchBtn');
        const pauseBtn = document.getElementById('pauseSearchBtn');
        const stopBtn = document.getElementById('stopSearchBtn');

        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = '暂停';
        pauseBtn.style.backgroundColor = '#ff9800';
        pauseBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        pauseBtn.style.transform = 'scale(1)';

        updateStatus("已停止");
        updateProgress(currentSearchCount, sessionTotalSearches || 0);

        // 关闭控制面板
        const panel = document.getElementById('autoSearchControlPanel');
        if (panel) {
            panel.remove();
        }
    }

    // 页面加载时恢复状态和进度
    function restoreStateOnLoad() {
        const savedProgress = localStorage.getItem('bingAutoSearchProgress');
        if (savedProgress) {
            const { current, total } = JSON.parse(savedProgress);
            if (document.getElementById('autoSearchProgress')) {
                document.getElementById('autoSearchProgress').textContent = `进度: ${current}/${total}`;
            }
        }

        const savedState = localStorage.getItem('bingAutoSearchState');
        if (savedState) {
            const { isRunning: savedRunning, currentSearchCount: savedCount, totalSearches: savedTotal } = JSON.parse(savedState);
            if (savedRunning) {
                isRunning = true;
                currentSearchCount = savedCount;
                totalSearches = savedTotal;
                sessionTotalSearches = savedTotal;

                // 确保控制面板存在
                createControlPanel();

                const startBtn = document.getElementById('startSearchBtn');
                const pauseBtn = document.getElementById('pauseSearchBtn');
                const stopBtn = document.getElementById('stopSearchBtn');

                if (startBtn && pauseBtn && stopBtn) {
                    startBtn.disabled = true;
                    pauseBtn.disabled = false;
                    stopBtn.disabled = false;
                    pauseBtn.style.transform = 'scale(1.05)';
                    pauseBtn.style.boxShadow = '0 3px 8px rgba(255, 152, 0, 0.3)';
                }

                updateStatus("运行中 - 恢复搜索");

                setTimeout(() => {
                    deviceType = detectDeviceType();
                    if (deviceType === 'pc') {
                        getPcHotWords().then(words => {
                            hotWords = words;
                            performSearchCycle();
                        });
                    } else {
                        getMobileHotWords().then(words => {
                            hotWords = words;
                            performSearchCycle();
                        });
                    }
                }, 1000);
            }
        }
    }

    // 页面加载完成后初始化 - 默认不显示控制面板
    window.addEventListener('load', () => {
        // 不自动创建面板，用户通过菜单命令显示
        restoreStateOnLoad();
    });

    // 手机浏览器模拟用户上下滑动页面浏览
    function simulateSearchResultsBrowsing() {
        return new Promise(resolve => {
            if (isPaused || !isRunning) {
                resolve();
                return;
            }
            updateStatus("正在浏览搜索结果...");
            const isMobile = detectDeviceType() === 'mobile';
            const scrollSteps = isMobile ? Math.floor(Math.random() * 4) + 4 : Math.floor(Math.random() * 5) + 3;
            const totalBrowseTime = isMobile ? Math.floor(Math.random() * 6000) + 6000 : Math.floor(Math.random() * 8000) + 8000;
            const intervalBetweenSteps = totalBrowseTime / scrollSteps;
            let step = 0;
            let direction = 1;

            const scrollTimeout = setTimeout(() => {
                console.log("结果浏览滑动超时");
                clearInterval(scrollInterval);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(resolve, 800);
            }, 15000);

            scrollInterval = setInterval(() => {
                if (isPaused || !isRunning || step >= scrollSteps) {
                    clearInterval(scrollInterval);
                    clearTimeout(scrollTimeout);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setTimeout(resolve, 800);
                    return;
                }
                const maxScroll = Math.max(
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.clientHeight,
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                );
                let scrollPosition;
                if (isMobile) {
                    if (step % 2 === 0) {
                        direction = direction * -1;
                    }
                    scrollPosition = direction > 0
                        ? maxScroll * (0.2 + Math.random() * 0.5)
                        : maxScroll * (0.1 + Math.random() * 0.2);
                } else {
                    if (step === 0) {
                        scrollPosition = maxScroll * (0.2 + Math.random() * 0.1);
                    } else if (step === scrollSteps - 1) {
                        scrollPosition = 0;
                    } else if (Math.random() < 0.2) {
                        const currentPos = window.scrollY;
                        scrollPosition = Math.max(0, currentPos - maxScroll * (0.05 + Math.random() * 0.1));
                    } else {
                        const currentPos = window.scrollY;
                        scrollPosition = Math.min(
                            maxScroll * 0.9,
                            currentPos + maxScroll * (0.08 + Math.random() * 0.15)
                        );
                    }
                }
                window.scrollTo({ top: scrollPosition, behavior: 'smooth' });
                step++;
            }, intervalBetweenSteps);
        });
    }

    // 添加菜单命令：修复手机端菜单点击不显示面板的问题
    if (typeof GM_registerMenuCommand === 'function') {
        // 确保菜单命令能正确触发面板显示
        GM_registerMenuCommand('显示控制面板', function () {
            // 强制创建并显示面板
            createControlPanel();
            // 确保面板在视口中可见
            const panel = document.getElementById('autoSearchControlPanel');
            if (panel) {
                panel.style.display = 'block';
                panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 's');

        GM_registerMenuCommand('关闭面板', function () {
            closeControlPanelAndScript();
        }, 'c');
    }

    // 控制面板显示函数
    function showControlPanel() {
        createControlPanel();
    }

    // 关闭面板和脚本
    function closeControlPanelAndScript() {
        const panel1 = document.getElementById('autoSearchPanel');
        const panel2 = document.getElementById('autoSearchControlPanel');
        if (panel1) panel1.remove();
        if (panel2) panel2.remove();
        if (typeof stopSearch === 'function') stopSearch();
        updateStatus('已停止');
    }
})();
