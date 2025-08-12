// ==UserScript==
// @name         国内必应自动搜索（优化版）
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  自动完成必应搜索任务，支持PC和手机端，带菜单控制和优化的面板
// @author       Your Name
// @match        https://cn.bing.com/*
// @match        https://www.bing.com/*
// @icon         https://cn.bing.com/favicon.ico
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      top.baidu.com
// @connect      rebang.today
// @connect      ranks.hao.360.com
// @connect      gumengya.com
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
    let controlPanel = null;

    // 配置参数
    const max_rewards = 40; // 最大搜索次数
    const pause_time = 960000; // 暂停时长16分钟(毫秒)
    const appkey = ""; // 从https://www.gmya.net/api申请的APIKEY
    const Hot_words_apis = "https://api.gmya.net/Api/";
    const keywords_source = ['BaiduHot', 'TouTiaoHot', 'DouYinHot', 'WeiBoHot'];
    let current_source_index = 0;

    // 默认搜索词
    const default_search_words = ["盛年不重来，一日难再晨", "千里之行，始于足下", "少年易学老难成，一寸光阴不可轻", "敏而好学，不耻下问", "海内存知已，天涯若比邻", "三人行，必有我师焉",
        "莫愁前路无知已，天下谁人不识君", "人生贵相知，何用金与钱", "天生我材必有用", "海纳百川有容乃大；壁立千仞无欲则刚", "穷则独善其身，达则兼济天下", "读书破万卷，下笔如有神",
        "学而不思则罔，思而不学则殆", "一年之计在于春，一日之计在于晨", "莫等闲，白了少年头，空悲切", "少壮不努力，老大徒伤悲", "一寸光阴一寸金，寸金难买寸光阴", "近朱者赤，近墨者黑",
        "吾生也有涯，而知也无涯", "纸上得来终觉浅，绝知此事要躬行", "学无止境", "己所不欲，勿施于人", "天将降大任于斯人也", "鞠躬尽瘁，死而后已", "书到用时方恨少", "天下兴亡，匹夫有责",
        "人无远虑，必有近忧", "为中华之崛起而读书", "一日无书，百事荒废", "岂能尽如人意，但求无愧我心", "人生自古谁无死，留取丹心照汗青", "吾生也有涯，而知也无涯", "生于忧患，死于安乐",
        "言必信，行必果", "读书破万卷，下笔如有神", "夫君子之行，静以修身，俭以养德", "老骥伏枥，志在千里", "一日不读书，胸臆无佳想", "王侯将相宁有种乎", "淡泊以明志。宁静而致远,", "卧龙跃马终黄土"];

    // 创建菜单命令
    GM_registerMenuCommand('开始自动搜索', showControlPanel, 's');
    GM_registerMenuCommand('停止自动搜索', stopSearch, 't');

    // 创建控制面板
    function createControlPanel() {
        if (controlPanel) return controlPanel;
        
        controlPanel = document.createElement('div');
        controlPanel.style.position = 'fixed';
        controlPanel.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        controlPanel.style.border = '1px solid #ccc';
        controlPanel.style.borderRadius = '8px';
        controlPanel.style.padding = '15px';
        controlPanel.style.boxShadow = '0 4px 15px rgba(0,0,0,0.15)';
        controlPanel.style.zIndex = '999999';
        controlPanel.style.width = '280px';
        controlPanel.id = 'autoSearchControlPanel';
        controlPanel.style.display = 'none'; // 默认隐藏

        // 标题
        const title = document.createElement('h3');
        title.textContent = '必应自动搜索控制';
        title.style.margin = '0 0 15px 0';
        title.style.fontSize = '18px';
        title.style.textAlign = 'center';
        title.style.color = '#333';
        controlPanel.appendChild(title);

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
        controlPanel.appendChild(statusDiv);

        // 进度显示
        const progressDiv = document.createElement('div');
        progressDiv.id = 'autoSearchProgress';
        progressDiv.style.margin = '0 0 15px 0';
        progressDiv.style.textAlign = 'center';
        progressDiv.style.fontSize = '15px';
        progressDiv.style.color = '#666';
        progressDiv.textContent = '进度: 0/0';
        controlPanel.appendChild(progressDiv);

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

        controlPanel.appendChild(buttonsDiv);
        document.body.appendChild(controlPanel);
        
        return controlPanel;
    }

    // 显示控制面板
    function showControlPanel() {
        createControlPanel();
        controlPanel.style.display = 'block';
        
        // 设备适配
        if (detectDeviceType() === 'mobile') {
            controlPanel.style.left = '50%';
            controlPanel.style.top = '50%';
            controlPanel.style.transform = 'translate(-50%, -50%)';
            controlPanel.style.right = 'auto';
            controlPanel.style.width = '90vw';
            controlPanel.style.maxWidth = '320px';
            controlPanel.style.fontSize = '17px';
            controlPanel.style.padding = '15px 2vw';
            
            // 按钮自适应
            const btns = controlPanel.querySelectorAll('button');
            btns.forEach(btn => {
                btn.style.fontSize = '16px';
                btn.style.padding = '12px 0';
                btn.style.width = '30%';
            });
        } else {
            controlPanel.style.left = '20px';
            controlPanel.style.top = '20px';
            controlPanel.style.transform = 'none';
        }
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

    // 获取热门搜索词
    async function getHotWords() {
        while (current_source_index < keywords_source.length) {
            const source = keywords_source[current_source_index];
            let url;
            
            if (appkey) {
                url = Hot_words_apis + source + "?format=json&appkey=" + appkey;
            } else {    
                url = Hot_words_apis + source;
            }
            
            try {
                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: url,
                        timeout: 10000,
                        onload: resolve,
                        onerror: reject,
                        ontimeout: reject
                    });
                });
                
                if (response.status === 200) {
                    const data = JSON.parse(response.responseText);
                    if (data.data && data.data.length > 0) {
                        return data.data.map(item => item.title ? optimizeHotWord(item.title) : null)
                            .filter(word => word && word.length >= 2);
                    }
                }
            } catch (error) {
                console.error('获取热词失败:', error);
            }
            
            current_source_index++;
        }
        
        // 所有来源都失败，使用默认搜索词
        return default_search_words.map(word => optimizeHotWord(word));
    }

    // 随机生成延迟时间
    function getRandomDelay() {
        return Math.floor(Math.random() * 13) + 3; // 3-15秒
    }

    // 随机选择热词并从列表中移除
    function getRandomItemAndRemove(arr) {
        if (!arr || arr.length === 0) return null;

        const index = Math.floor(Math.random() * arr.length);
        const item = arr[index];
        arr.splice(index, 1);

        // 如果数组为空，重新填充
        if (arr.length === 0) {
            console.log("热词已用尽，重新获取热词");
            getHotWords().then(words => hotWords = words);
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

    // 自动处理搜索词
    function AutoStrTrans(st) {
        let yStr = st;
        let rStr = ""; // 可添加混淆字符
        let zStr = "";
        let prePo = 0;
        
        for (let i = 0; i < yStr.length;) {
            let step = parseInt(Math.random() * 5) + 1;
            if (i > 0) {
                zStr = zStr + yStr.substr(prePo, i - prePo) + rStr;
                prePo = i;
            }
            i = i + step;
        }
        
        if (prePo < yStr.length) {
            zStr = zStr + yStr.substr(prePo, yStr.length - prePo);
        }
        
        return zStr;
    }

    // 生成随机字符串
    function generateRandomString(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        const charactersLength = characters.length;
        
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        
        return result;
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
        
        // 处理搜索词
        const processedQuery = AutoStrTrans(query);
        const randomString = generateRandomString(4);
        const randomCvid = generateRandomString(32);
        
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
                        
                        if (i < processedQuery.length) {
                            searchBox.value += processedQuery[i];
                            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                            searchBox.dispatchEvent(new Event('change', { bubbles: true }));
                            searchBox.dispatchEvent(new Event('keydown', {
                                bubbles: true,
                                key: processedQuery[i]
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
                                    const enterEvent = new KeyboardEvent('keypress', {
                                        key: 'Enter',
                                        code: 'Enter',
                                        keyCode: 13,
                                        which: 13,
                                        bubbles: true
                                    });
                                    searchBox.dispatchEvent(enterEvent);
                                    setTimeout(performSearchCycle, 1500);
                                }
                            }, Math.floor(Math.random() * 1500) + 500);
                        }
                    }, Math.floor(Math.random() * 150) + 50);
                }, 500);
            } else if (searchBoxAttempts >= maxAttempts) {
                clearInterval(searchBoxInterval);
                // 直接跳转搜索
                const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(processedQuery)}&form=${randomString}&cvid=${randomCvid}`;
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
        // 恢复状态
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

        // 检查是否达到最大搜索次数
        if (currentSearchCount >= max_rewards) {
            updateStatus(`已完成所有${max_rewards}次搜索`);
            stopSearch();
            alert(`已完成所有${max_rewards}次搜索任务！`);
            return;
        }

        // 每5次搜索后插入暂停
        if ((currentSearchCount + 1) % 5 === 0 && currentSearchCount > 0) {
            updateStatus(`已完成${currentSearchCount}次搜索，暂停${pause_time/60000}分钟`);
            setTimeout(() => {
                performSearchCycle();
            }, pause_time);
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

        // 等待期间模拟行为
        await new Promise(resolve => {
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

    // 执行下一步搜索
    function executeNextSearchStep() {
        if (!isRunning || isPaused) return;

        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }

        const randomWord = getRandomItemAndRemove(hotWords);
        currentSearchCount++;
        updateProgress(currentSearchCount, max_rewards);
        performSearch(randomWord);
    }

    // 开始搜索
    async function startSearch() {
        if (isRunning) return;
        isRunning = true;
        isPaused = false;
        isFirstSearch = true;
        current_source_index = 0;

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
                hotWords = default_search_words.map(word => optimizeHotWord(word));
                initializeSearchProcess();
            }
        }, 20000);

        try {
            hotWords = await getHotWords();
            clearTimeout(hotWordFetchTimeout);
            
            if (hotWords.length === 0) {
                throw new Error("未获取到有效热词");
            }
            
            initializeSearchProcess();
        } catch (e) {
            clearTimeout(hotWordFetchTimeout);
            updateStatus("热词获取失败，使用备用方案");
            hotWords = default_search_words.map(word => optimizeHotWord(word));
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

            sessionTotalSearches = max_rewards;

            const savedProgress = localStorage.getItem('bingAutoSearchProgress');
            if (savedProgress) {
                const { current, total } = JSON.parse(savedProgress);
                if (total === max_rewards) {
                    currentSearchCount = current;
                } else {
                    currentSearchCount = 0;
                }
            } else {
                currentSearchCount = 0;
            }

            if (currentSearchCount >= max_rewards) {
                currentSearchCount = 0;
            }

            updateProgress(currentSearchCount, max_rewards);

            localStorage.setItem('bingAutoSearchState', JSON.stringify({
                isRunning: isRunning,
                currentSearchCount: currentSearchCount,
                totalSearches: max_rewards,
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
            totalSearches: max_rewards,
            isFirstSearch: isFirstSearch
        }));

        // 暂停时清除所有可能的计时器
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

    // 停止搜索
    function stopSearch() {
        isRunning = false;
        isPaused = false;
        
        if (countdownInterval) clearInterval(countdownInterval);
        if (scrollInterval) clearInterval(scrollInterval);
        clearTimeout(hotWordFetchTimeout);

        localStorage.removeItem('bingAutoSearchState');

        // 隐藏控制面板
        if (controlPanel) {
            controlPanel.style.display = 'none';
        }

        // 更新按钮状态
        const startBtn = document.getElementById('startSearchBtn');
        const pauseBtn = document.getElementById('pauseSearchBtn');
        const stopBtn = document.getElementById('stopSearchBtn');

        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) {
            pauseBtn.disabled = true;
            pauseBtn.textContent = '暂停';
            pauseBtn.style.backgroundColor = '#ff9800';
            pauseBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
            pauseBtn.style.transform = 'scale(1)';
        }
        if (stopBtn) stopBtn.disabled = true;

        updateStatus("已停止");
        updateProgress(currentSearchCount, sessionTotalSearches || 0);
    }

    // 恢复状态
    function restoreStateOnLoad() {
        const savedProgress = localStorage.getItem('bingAutoSearchProgress');
        if (savedProgress) {
            const { current, total } = JSON.parse(savedProgress);
            const progressDiv = document.getElementById('autoSearchProgress');
            if (progressDiv) {
                progressDiv.textContent = `进度: ${current}/${total}`;
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

                // 创建面板并更新状态
                createControlPanel();
                const startBtn = document.getElementById('startSearchBtn');
                const pauseBtn = document.getElementById('pauseSearchBtn');
                const stopBtn = document.getElementById('stopSearchBtn');

                if (startBtn) startBtn.disabled = true;
                if (pauseBtn) {
                    pauseBtn.disabled = false;
                    pauseBtn.style.transform = 'scale(1.05)';
                    pauseBtn.style.boxShadow = '0 3px 8px rgba(255, 152, 0, 0.3)';
                }
                if (stopBtn) stopBtn.disabled = false;

                updateStatus("运行中 - 恢复搜索");

                setTimeout(() => {
                    deviceType = detectDeviceType();
                    getHotWords().then(words => {
                        hotWords = words;
                        performSearchCycle();
                    });
                }, 1000);
            }
        }
    }

    // 模拟浏览搜索结果
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

    // 平滑滚动到底部
    function smoothScrollToBottom() {
        document.documentElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    // 页面加载完成后初始化
    window.addEventListener('load', () => {
        createControlPanel(); // 创建但不显示面板
        restoreStateOnLoad();
    });
})();
