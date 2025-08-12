// ==UserScript==
// @name         国内必应自动搜索（修复搜索提交版）
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  修复搜索框有词但不提交的问题，确保搜索流程连贯
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

    // 从百度热榜获取PC端热词
    function getPcHotWords() {
        return new Promise((resolve, reject) => {
            const hotListUrl = 'https://top.baidu.com/board?tab=realtime';
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: hotListUrl,
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
                }
            });
        });
    }

    // 从今日头条获取移动端热词
    function getMobileHotWords() {
        return new Promise((resolve, reject) => {
            const hotListUrl = 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc';
            
            GM_xmlhttpRequest({
                method: 'GET',
                url: hotListUrl,
                onload: function(response) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        const hotWordElements = doc.querySelectorAll('.hot-event-item-title');
                        
                        let hotWords = Array.from(hotWordElements)
                            .map(el => el.textContent.trim())
                            .filter(word => word.length > 0)
                            .map(word => optimizeHotWord(word))
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
            "手游攻略", "移动支付安全", "短视频制作", "手机评测", "充电宝选购"
        ];
    }

    // 随机生成延迟时间（5-30秒）
    function getRandomDelay() {
        return Math.floor(Math.random() * 26) + 5;
    }

    // 随机选择热词
    function getRandomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // 模拟浏览行为
    function simulateBrowsing() {
        return new Promise(resolve => {
            if (isPaused || !isRunning) {
                resolve();
                return;
            }
            
            if (Math.random() < 0.3) {
                console.log("模拟用户浏览行为...");
                updateStatus("正在浏览页面...");
                
                const scrollTimes = Math.floor(Math.random() * 3) + 1;
                let scrollCount = 0;
                
                const scrollInterval = setInterval(() => {
                    if (isPaused || !isRunning) {
                        clearInterval(scrollInterval);
                        resolve();
                        return;
                    }
                    
                    const scrollPosition = Math.floor(Math.random() * document.body.scrollHeight * 0.8);
                    window.scrollTo({
                        top: scrollPosition,
                        behavior: 'smooth'
                    });
                    
                    scrollCount++;
                    if (scrollCount >= scrollTimes) {
                        clearInterval(scrollInterval);
                        setTimeout(resolve, Math.floor(Math.random() * 2000) + 1000);
                    }
                }, Math.floor(Math.random() * 1500) + 1000);
            } else {
                resolve();
            }
        });
    }

    // 模拟点击行为
    function simulateClicking() {
        return new Promise(resolve => {
            if (isPaused || !isRunning) {
                resolve();
                return;
            }
            
            if (Math.random() < 0.2) {
                console.log("模拟用户点击行为...");
                updateStatus("正在点击页面元素...");
                
                const clickableSelectors = [
                    'a[href]', 
                    'button', 
                    '.b_algo h2 a',
                    '.b_pag a',
                    '#sb_form_q'
                ];
                
                const randomSelector = getRandomItem(clickableSelectors);
                const elements = document.querySelectorAll(randomSelector);
                
                if (elements.length > 0) {
                    const randomElement = elements[Math.floor(Math.random() * elements.length)];
                    
                    const rect = randomElement.getBoundingClientRect();
                    const mouseEvent = new MouseEvent('mousemove', {
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top + rect.height / 2,
                        bubbles: true
                    });
                    randomElement.dispatchEvent(mouseEvent);
                    
                    setTimeout(() => {
                        if (isPaused || !isRunning) {
                            resolve();
                            return;
                        }
                        
                        randomElement.click();
                        if (randomSelector === '.b_algo h2 a') {
                            setTimeout(resolve, Math.floor(Math.random() * 5000) + 3000);
                        } else {
                            setTimeout(resolve, Math.floor(Math.random() * 1000) + 500);
                        }
                    }, Math.floor(Math.random() * 800) + 200);
                } else {
                    resolve();
                }
            } else {
                resolve();
            }
        });
    }

    // 执行搜索（重点修复搜索提交问题）
    function performSearch(query) {
        if (isPaused || !isRunning) return;
        
        // 确保搜索词有效
        if (!query || query.trim().length === 0) {
            console.error("无效的搜索词，跳过本次搜索");
            updateStatus("搜索词无效，准备下一次");
            setTimeout(performSearchCycle, 2000);
            return;
        }
        
        // 多次尝试获取搜索框，解决可能的加载延迟问题
        let searchBoxAttempts = 0;
        const maxAttempts = 5;
        const searchBoxInterval = setInterval(() => {
            const searchBox = document.getElementById('sb_form_q');
            searchBoxAttempts++;
            
            if (searchBox) {
                clearInterval(searchBoxInterval);
                updateStatus(`搜索中: ${query}`);
                
                // 确保搜索框可见并可交互
                searchBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // 清空搜索框（带延迟确保操作生效）
                setTimeout(() => {
                    searchBox.value = '';
                    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                    searchBox.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // 模拟人类打字（改进版）
                    let i = 0;
                    const typeInterval = setInterval(() => {
                        if (!isRunning || isPaused) {
                            clearInterval(typeInterval);
                            return;
                        }
                        
                        if (i < query.length) {
                            searchBox.value += query[i];
                            // 触发多种事件，确保必应识别输入
                            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                            searchBox.dispatchEvent(new Event('change', { bubbles: true }));
                            searchBox.dispatchEvent(new Event('keydown', { 
                                bubbles: true, 
                                key: query[i] 
                            }));
                            i++;
                        } else {
                            clearInterval(typeInterval);
                            // 输入完成后聚焦并等待
                            searchBox.focus();
                            
                            // 提交搜索（多重保障机制）
                            setTimeout(() => {
                                if (!isRunning || isPaused) return;
                                
                                // 保存当前状态
                                const currentState = {
                                    isRunning: isRunning,
                                    currentSearchCount: currentSearchCount,
                                    totalSearches: totalSearches,
                                    isFirstSearch: false
                                };
                                localStorage.setItem('bingAutoSearchState', JSON.stringify(currentState));
                                
                                // 方法1：模拟Enter键（主要方法）
                                const enterEvent = new KeyboardEvent('keypress', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true
                                });
                                searchBox.dispatchEvent(enterEvent);
                                
                                // 方法2：点击搜索按钮（备用方法，1秒后执行以防方法1失败）
                                setTimeout(() => {
                                    if (document.getElementById('sb_form_q') && 
                                        document.getElementById('sb_form_q').value === query) {
                                        console.log("Enter键提交失败，尝试点击搜索按钮");
                                        const searchButton = document.getElementById('sb_form_go') || 
                                                          document.querySelector('input[type="submit"]') ||
                                                          document.querySelector('.search-icon');
                                        
                                        if (searchButton) {
                                            searchButton.click();
                                        } else {
                                            // 方法3：直接跳转URL（终极保障）
                                            console.log("搜索按钮未找到，直接跳转URL");
                                            window.location.href = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
                                        }
                                    }
                                }, 1000);
                                
                                // 确保搜索循环继续
                                setTimeout(performSearchCycle, 1500);
                            }, Math.floor(Math.random() * 1500) + 500);
                        }
                    }, Math.floor(Math.random() * 150) + 50);
                }, 500);
            } else if (searchBoxAttempts >= maxAttempts) {
                // 多次尝试失败后直接通过URL搜索
                clearInterval(searchBoxInterval);
                console.log("无法找到搜索框，将使用URL直接搜索");
                const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
                
                // 保存状态后跳转
                const currentState = {
                    isRunning: isRunning,
                    currentSearchCount: currentSearchCount,
                    totalSearches: totalSearches,
                    isFirstSearch: false
                };
                localStorage.setItem('bingAutoSearchState', JSON.stringify(currentState));
                
                window.location.href = searchUrl;
                setTimeout(performSearchCycle, 2000);
            }
        }, 500); // 每500ms尝试一次
    }

    // 搜索循环
    async function performSearchCycle() {
        // 从存储恢复状态
        const savedState = localStorage.getItem('bingAutoSearchState');
        if (savedState) {
            const { isRunning: savedRunning, currentSearchCount: savedCount, totalSearches: savedTotal } = JSON.parse(savedState);
            if (savedRunning && !isRunning) {
                isRunning = true;
                currentSearchCount = savedCount;
                totalSearches = savedTotal;
                sessionTotalSearches = savedTotal;
                
                // 更新按钮状态
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

        // 倒计时显示
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

        // 等待期间模拟行为
        await new Promise(resolve => {
            if (isPaused || !isRunning) {
                resolve();
                return;
            }
            setTimeout(resolve, Math.floor(delaySeconds * 1000 * 0.6));
        });
        
        if (isPaused || !isRunning) return;
        
        await simulateBrowsing();
        if (isPaused || !isRunning) return;
        
        await simulateClicking();
        if (isPaused || !isRunning) return;
        
        await new Promise(resolve => {
            if (isPaused || !isRunning) {
                resolve();
                return;
            }
            setTimeout(resolve, Math.floor(delaySeconds * 1000 * 0.4));
        });

        if (isPaused || !isRunning) return;

        // 执行搜索
        const randomWord = getRandomItem(hotWords);
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
        
        // 更新按钮状态
        document.getElementById('startSearchBtn').disabled = true;
        document.getElementById('pauseSearchBtn').disabled = false;
        document.getElementById('stopSearchBtn').disabled = false;
        
        // 高亮显示运行状态
        document.getElementById('pauseSearchBtn').style.transform = 'scale(1.05)';
        document.getElementById('pauseSearchBtn').style.boxShadow = '0 3px 8px rgba(255, 152, 0, 0.3)';
        
        updateStatus("准备中...");
        
        // 检测设备类型
        deviceType = detectDeviceType();
        console.log(`设备类型: ${deviceType}`);
        
        // 设置参数
        if (deviceType === 'pc') {
            totalSearches = 40;
        } else {
            totalSearches = 30;
        }
        sessionTotalSearches = totalSearches;
        
        // 获取热词
        updateStatus("获取热榜中...");
        if (deviceType === 'pc') {
            hotWords = await getPcHotWords();
        } else {
            hotWords = await getMobileHotWords();
        }
        
        // 恢复进度
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
        
        // 保存初始状态
        localStorage.setItem('bingAutoSearchState', JSON.stringify({
            isRunning: isRunning,
            currentSearchCount: currentSearchCount,
            totalSearches: totalSearches,
            isFirstSearch: isFirstSearch
        }));
        
        updateStatus("开始搜索流程");
        
        // 启动第一次搜索
        setTimeout(performSearchCycle, 1000);
    }

    // 暂停/继续
    function togglePause() {
        if (!isRunning) return;
        
        isPaused = !isPaused;
        const pauseBtn = document.getElementById('pauseSearchBtn');
        
        // 保存暂停/继续状态
        localStorage.setItem('bingAutoSearchState', JSON.stringify({
            isRunning: isRunning,
            currentSearchCount: currentSearchCount,
            totalSearches: totalSearches,
            isFirstSearch: isFirstSearch
        }));
        
        if (isPaused) {
            pauseBtn.textContent = '继续';
            pauseBtn.style.backgroundColor = '#4caf50';
            pauseBtn.style.boxShadow = '0 3px 8px rgba(76, 175, 80, 0.3)';
            updateStatus("已暂停");
            if (countdownInterval) clearInterval(countdownInterval);
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
        
        // 清除状态存储
        localStorage.removeItem('bingAutoSearchState');
        
        // 重置按钮
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
        
        // 重置状态
        updateStatus("已停止");
        updateProgress(currentSearchCount, sessionTotalSearches || 0);
    }

    // 页面加载时恢复状态和进度
    function restoreStateOnLoad() {
        // 恢复进度显示
        const savedProgress = localStorage.getItem('bingAutoSearchProgress');
        if (savedProgress) {
            const { current, total } = JSON.parse(savedProgress);
            if (document.getElementById('autoSearchProgress')) {
                document.getElementById('autoSearchProgress').textContent = `进度: ${current}/${total}`;
            }
        }
        
        // 恢复运行状态
        const savedState = localStorage.getItem('bingAutoSearchState');
        if (savedState) {
            const { isRunning: savedRunning, currentSearchCount: savedCount, totalSearches: savedTotal } = JSON.parse(savedState);
            if (savedRunning) {
                isRunning = true;
                currentSearchCount = savedCount;
                totalSearches = savedTotal;
                sessionTotalSearches = savedTotal;
                
                // 更新UI状态
                document.getElementById('startSearchBtn').disabled = true;
                document.getElementById('pauseSearchBtn').disabled = false;
                document.getElementById('stopSearchBtn').disabled = false;
                document.getElementById('pauseSearchBtn').style.transform = 'scale(1.05)';
                document.getElementById('pauseSearchBtn').style.boxShadow = '0 3px 8px rgba(255, 152, 0, 0.3)';
                
                updateStatus("运行中 - 恢复搜索");
                
                // 继续搜索循环
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

    // 页面加载完成后初始化
    window.addEventListener('load', () => {
        if (!document.getElementById('autoSearchControlPanel')) {
            createControlPanel();
        }
        // 恢复状态和进度
        restoreStateOnLoad();
    });
})();
