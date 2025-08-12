// ==UserScript==
// @name         国内必应自动搜索（热榜修复版）
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  修复热榜获取卡住问题，增加超时和重试机制
// @author       Your Name
// @match        https://cn.bing.com/*
// @icon         https://cn.bing.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @connect      top.baidu.com
// @connect      www.toutiao.com
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

    // 创建控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.style.position = 'fixed';
        panel.style.top = '20px';
        panel.style.right = '20px';
        panel.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        panel.style.border = '1px solid #ccc';
        panel.style.borderRadius = '8px';
        panel.style.padding = '15px';
        panel.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)';
        panel.style.zIndex = '999999';
        panel.style.width = '280px';
        panel.id = 'autoSearchControlPanel';

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
        pauseBtn.disabled = true;
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
        stopBtn.disabled = true;
        stopBtn.addEventListener('click', stopSearch);
        buttonsDiv.appendChild(stopBtn);

        panel.appendChild(buttonsDiv);
        document.body.appendChild(panel);
    }

    // 更新状态显示
    function updateStatus(text) {
        const statusDiv = document.getElementById('autoSearchStatus');
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

    // 更新进度显示
    function updateProgress(current, total) {
        document.getElementById('autoSearchProgress').textContent = `进度: ${current}/${total}`;
        localStorage.setItem('bingAutoSearchProgress', JSON.stringify({
            current: current,
            total: total,
            timestamp: new Date().getTime()
        }));
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

    // 带超时和重试的HTTP请求
    function requestWithTimeout(url, timeout = 8000) {
        return new Promise((resolve, reject) => {
            // 设置超时
            const timer = setTimeout(() => {
                reject(new Error(`请求超时 (${timeout}ms)`));
            }, timeout);
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    clearTimeout(timer);
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response);
                    } else {
                        reject(new Error(`HTTP错误: ${response.status}`));
                    }
                },
                onerror: function(error) {
                    clearTimeout(timer);
                    reject(error);
                }
            });
        });
    }

    // 带重试机制的函数
    async function retryOperation(operation, maxRetries = 3, delayMs = 1000) {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                console.log(`尝试 ${i + 1} 失败，${i < maxRetries - 1 ? '将重试' : '已达最大重试次数'}`);
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }
        throw lastError;
    }

    // 从百度热榜获取PC端热词（带重试和超时）
    function getPcHotWords() {
        return retryOperation(async () => {
            const hotListUrl = 'https://top.baidu.com/board?tab=realtime';
            
            try {
                const response = await requestWithTimeout(hotListUrl);
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                const hotWordElements = doc.querySelectorAll('.c-single-text-ellipsis');
                
                let hotWords = Array.from(hotWordElements)
                    .map(el => el.textContent.trim())
                    .filter(word => word.length > 0)
                    .map(word => optimizeHotWord(word))
                    .filter(word => word.length >= 3);
                
                if (hotWords.length < 10) {
                    console.log(`百度热榜获取热词不足，使用备用词库`);
                    return getFallbackPcWords();
                }
                
                // 确保有足够的热词
                while (hotWords.length < 40) {
                    hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 40 - hotWords.length)));
                }
                
                return hotWords.slice(0, 40);
            } catch (e) {
                console.error('获取百度热榜失败:', e);
                return getFallbackPcWords();
            }
        });
    }

    // 从今日头条获取移动端热词（带重试和超时）
    function getMobileHotWords() {
        return retryOperation(async () => {
            const hotListUrl = 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc';
            
            try {
                const response = await requestWithTimeout(hotListUrl);
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.responseText, 'text/html');
                const hotWordElements = doc.querySelectorAll('.hot-event-item-title');
                
                let hotWords = Array.from(hotWordElements)
                    .map(el => el.textContent.trim())
                    .filter(word => word.length > 0)
                    .map(word => optimizeHotWord(word))
                    .filter(word => word.length >= 2);
                
                if (hotWords.length < 10) {
                    console.log(`今日头条热榜获取热词不足，使用备用词库`);
                    return getFallbackMobileWords();
                }
                
                // 确保有足够的热词
                while (hotWords.length < 30) {
                    hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 30 - hotWords.length)));
                }
                
                return hotWords.slice(0, 30);
            } catch (e) {
                console.error('获取今日头条热榜失败:', e);
                return getFallbackMobileWords();
            }
        });
    }

    // 扩展的PC端备用热词库
    function getFallbackPcWords() {
        return [
            "人工智能发展", "全球经济趋势", "量子计算突破", "新能源技术", "元宇宙应用",
            "区块链创新", "5G技术进展", "太空探索", "自动驾驶", "大数据分析",
            "云计算发展", "网络安全动态", "机器学习", "边缘计算", "数字货币",
            "生物科技", "虚拟现实", "增强现实", "物联网", "智能家居",
            "可再生能源", "气候变化影响", "健康饮食指南", "远程工作趋势", "数字货币监管",
            "电动汽车发展", "航天技术突破", "人工智能伦理", "在线教育创新", "医疗技术进步",
            "智能城市建设", "区块链应用", "机器人技术", "无人机应用", "3D打印技术",
            "生物识别技术", "纳米技术发展", "量子通信", "脑机接口", "太空旅游"
        ];
    }

    // 扩展的移动端备用热词库
    function getFallbackMobileWords() {
        return [
            "手机新品发布", "短视频热门挑战", "移动游戏排行榜", "手机摄影技巧", "流量套餐对比",
            "手游攻略大全", "移动支付安全", "短视频制作教程", "手机性能评测", "充电宝选购指南",
            "5G手机推荐", "手机续航测试", "拍照手机排行", "手游内测资格", "手机清理技巧",
            "直播带货技巧", "手机维修指南", "手机膜选购", "云游戏体验", "手机散热方法",
            "短视频剪辑软件", "手机云台推荐", "手游加速器", "手机数据恢复", "手机电池保养",
            "移动流量节省", "手机支架推荐", "手机防水测试", "夜间拍摄技巧", "手机信号增强"
        ];
    }

    // 模拟浏览滑动行为
    function simulateSearchResultsBrowsing() {
        return new Promise(resolve => {
            if (isPaused || !isRunning) {
                resolve();
                return;
            }
            
            updateStatus("正在浏览搜索结果...");
            console.log("开始模拟浏览搜索结果...");
            
            // 随机生成滑动次数（3-7次）
            const scrollSteps = Math.floor(Math.random() * 5) + 3;
            // 随机生成总浏览时间（8-15秒）
            const totalBrowseTime = Math.floor(Math.random() * 8000) + 8000;
            const intervalBetweenSteps = totalBrowseTime / scrollSteps;
            
            let step = 0;
            const scrollInterval = setInterval(() => {
                if (isPaused || !isRunning || step >= scrollSteps) {
                    clearInterval(scrollInterval);
                    // 最后回到页面顶部
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                    setTimeout(resolve, 1000);
                    return;
                }
                
                // 计算滑动位置
                const maxScroll = Math.max(
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.clientHeight,
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                );
                
                // 模拟人类阅读的滑动模式
                let scrollPosition;
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
                
                // 执行滑动
                window.scrollTo({
                    top: scrollPosition,
                    behavior: 'smooth'
                });
                
                step++;
            }, intervalBetweenSteps);
        });
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
                                
                                // 提交搜索
                                const enterEvent = new KeyboardEvent('keypress', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true
                                });
                                searchBox.dispatchEvent(enterEvent);
                                
                                // 搜索后处理
                                setTimeout(() => {
                                    const resultsLoadDelay = Math.floor(Math.random() * 2000) + 1000;
                                    setTimeout(() => {
                                        simulateSearchResultsBrowsing().then(() => {
                                            performSearchCycle();
                                        });
                                    }, resultsLoadDelay);
                                }, 1000);
                            }, Math.floor(Math.random() * 1500) + 500);
                        }
                    }, Math.floor(Math.random() * 150) + 50);
                }, 500);
            } else if (searchBoxAttempts >= maxAttempts) {
                clearInterval(searchBoxInterval);
                console.log("无法找到搜索框，将使用URL直接搜索");
                const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
                
                const currentState = {
                    isRunning: isRunning,
                    currentSearchCount: currentSearchCount,
                    totalSearches: totalSearches,
                    isFirstSearch: false
                };
                localStorage.setItem('bingAutoSearchState', JSON.stringify(currentState));
                
                window.location.href = searchUrl;
                
                setTimeout(() => {
                    simulateSearchResultsBrowsing().then(() => {
                        performSearchCycle();
                    });
                }, 3000);
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

        const delaySeconds = Math.floor(Math.random() * 26) + 5;
        console.log(`第${currentSearchCount + 1}次搜索将在${delaySeconds}秒后进行`);
        updateStatus(`运行中 - 下次搜索: ${delaySeconds}秒`);

        let remaining = delaySeconds;
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            if (!isRunning || isPaused) {
                clearInterval(countdownInterval);
                return;
            }
            
            updateStatus(`运行中 - 下次搜索: ${remaining}秒`);
            remaining--;
            if (remaining < 0) clearInterval(countdownInterval);
        }, 1000);

        await new Promise(resolve => {
            if (isPaused || !isRunning) {
                resolve();
                return;
            }
            setTimeout(resolve, Math.floor(delaySeconds * 1000 * 0.6));
        });
        
        if (isPaused || !isRunning) return;
        
        // 执行搜索
        const randomWord = hotWords[Math.floor(Math.random() * hotWords.length)];
        currentSearchCount++;
        updateProgress(currentSearchCount, totalSearches);
        performSearch(randomWord);
    }

    // 开始搜索
    async function startSearch() {
        if (isRunning) return;
        
        isRunning = true;
        isPaused = false;
        isFirstSearch = true;
        
        document.getElementById('startSearchBtn').disabled = true;
        document.getElementById('pauseSearchBtn').disabled = false;
        document.getElementById('stopSearchBtn').disabled = false;
        
        updateStatus("准备中...");
        
        deviceType = detectDeviceType();
        console.log(`设备类型: ${deviceType}`);
        
        totalSearches = deviceType === 'pc' ? 40 : 30;
        sessionTotalSearches = totalSearches;
        
        try {
            updateStatus("获取热榜中...");
            // 增加热榜获取超时控制（15秒）
            const hotWordsPromise = deviceType === 'pc' ? getPcHotWords() : getMobileHotWords();
            
            // 15秒超时控制
            hotWords = await Promise.race([
                hotWordsPromise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("热榜获取超时")), 15000)
                )
            ]);
            
            initSearch();
        } catch (error) {
            console.error("热榜获取失败，使用备用词库:", error);
            // 直接使用备用词库，避免卡住
            hotWords = deviceType === 'pc' ? getFallbackPcWords() : getFallbackMobileWords();
            initSearch();
        }
        
        function initSearch() {
            const savedProgress = localStorage.getItem('bingAutoSearchProgress');
            if (savedProgress) {
                const { current, total } = JSON.parse(savedProgress);
                currentSearchCount = total === totalSearches ? current : 0;
            } else {
                currentSearchCount = 0;
            }
            
            if (currentSearchCount >= totalSearches) currentSearchCount = 0;
            
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
            pauseBtn.textContent = '继续';
            pauseBtn.style.backgroundColor = '#4caf50';
            updateStatus("已暂停");
            if (countdownInterval) clearInterval(countdownInterval);
        } else {
            pauseBtn.textContent = '暂停';
            pauseBtn.style.backgroundColor = '#ff9800';
            updateStatus("继续搜索流程");
            performSearchCycle();
        }
    }

    function stopSearch() {
        isRunning = false;
        isPaused = false;
        if (countdownInterval) clearInterval(countdownInterval);
        
        localStorage.removeItem('bingAutoSearchState');
        
        const startBtn = document.getElementById('startSearchBtn');
        const pauseBtn = document.getElementById('pauseSearchBtn');
        const stopBtn = document.getElementById('stopSearchBtn');
        
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        pauseBtn.textContent = '暂停';
        pauseBtn.style.backgroundColor = '#ff9800';
        
        updateStatus("已停止");
        updateProgress(currentSearchCount, sessionTotalSearches || 0);
    }

    // 页面加载时初始化
    window.addEventListener('load', () => {
        if (!document.getElementById('autoSearchControlPanel')) {
            createControlPanel();
        }
    });
})();
