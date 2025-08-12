// ==UserScript==
// @name         国内必应自动搜索（带浏览滑动）
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  自动搜索并在搜索后模拟用户滑动浏览页面
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

        // 标题、状态显示、进度显示和按钮的代码保持不变
        // （省略部分重复代码，完整代码见之前版本）
        
        const title = document.createElement('h3');
        title.textContent = '必应自动搜索控制';
        title.style.margin = '0 0 15px 0';
        title.style.fontSize = '18px';
        title.style.textAlign = 'center';
        title.style.color = '#333';
        panel.appendChild(title);

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

        const progressDiv = document.createElement('div');
        progressDiv.id = 'autoSearchProgress';
        progressDiv.style.margin = '0 0 15px 0';
        progressDiv.style.textAlign = 'center';
        progressDiv.style.fontSize = '15px';
        progressDiv.style.color = '#666';
        progressDiv.textContent = '进度: 0/0';
        panel.appendChild(progressDiv);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.gap = '10px';
        buttonsDiv.style.justifyContent = 'center';

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
        
        // 根据状态设置不同颜色（保持不变）
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

    // 更新进度显示（保持不变）
    function updateProgress(current, total) {
        document.getElementById('autoSearchProgress').textContent = `进度: ${current}/${total}`;
        localStorage.setItem('bingAutoSearchProgress', JSON.stringify({
            current: current,
            total: total,
            timestamp: new Date().getTime()
        }));
    }

    // 检测设备类型（保持不变）
    function detectDeviceType() {
        const userAgent = navigator.userAgent;
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        return mobileRegex.test(userAgent) ? 'mobile' : 'pc';
    }

    // 热词处理、获取热词等函数保持不变
    // （省略部分重复代码）

    // 增强的模拟浏览滑动行为 - 重点改进
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
                
                // 计算滑动位置（页面高度的10%到90%之间）
                const maxScroll = Math.max(
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.clientHeight,
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight
                );
                
                // 模拟人类阅读的滑动模式：先快后慢，偶尔回滚
                let scrollPosition;
                if (step === 0) {
                    // 第一步：快速浏览到页面20%-30%处
                    scrollPosition = maxScroll * (0.2 + Math.random() * 0.1);
                } else if (step === scrollSteps - 1) {
                    // 最后一步：回到页面顶部
                    scrollPosition = 0;
                } else if (Math.random() < 0.2) {
                    // 10%概率回滚一点
                    const currentPos = window.scrollY;
                    scrollPosition = Math.max(0, currentPos - maxScroll * (0.05 + Math.random() * 0.1));
                } else {
                    // 正常向下滚动
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
                
                // 随机点击一个搜索结果（20%概率）
                if (Math.random() < 0.2 && step > 0) {
                    const results = document.querySelectorAll('.b_algo h2 a');
                    if (results.length > 0) {
                        const randomResult = results[Math.floor(Math.random() * results.length)];
                        // 先移动鼠标到元素位置
                        const rect = randomResult.getBoundingClientRect();
                        const mouseEvent = new MouseEvent('mousemove', {
                            clientX: rect.left + rect.width / 2,
                            clientY: rect.top + rect.height / 2,
                            bubbles: true
                        });
                        randomResult.dispatchEvent(mouseEvent);
                        
                        // 短暂延迟后模拟点击
                        setTimeout(() => {
                            if (!isPaused && isRunning) {
                                randomResult.click();
                                // 打开后停留2-4秒再返回
                                setTimeout(() => {
                                    window.history.back();
                                }, Math.floor(Math.random() * 2000) + 2000);
                            }
                        }, Math.floor(Math.random() * 800) + 200);
                    }
                }
                
                step++;
            }, intervalBetweenSteps);
        });
    }

    // 执行搜索（添加搜索后浏览行为）
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
                                
                                // 提交搜索（多重保障机制）
                                const enterEvent = new KeyboardEvent('keypress', {
                                    key: 'Enter',
                                    code: 'Enter',
                                    keyCode: 13,
                                    which: 13,
                                    bubbles: true
                                });
                                searchBox.dispatchEvent(enterEvent);
                                
                                // 搜索提交后，等待结果加载并执行浏览行为
                                setTimeout(() => {
                                    // 等待搜索结果加载（1-3秒）
                                    const resultsLoadDelay = Math.floor(Math.random() * 2000) + 1000;
                                    setTimeout(() => {
                                        // 执行搜索结果浏览
                                        simulateSearchResultsBrowsing().then(() => {
                                            // 浏览完成后继续下一次搜索循环
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
                
                // URL跳转后，等待页面加载并执行浏览
                setTimeout(() => {
                    simulateSearchResultsBrowsing().then(() => {
                        performSearchCycle();
                    });
                }, 3000);
            }
        }, 500);
    }

    // 搜索循环（保持不变）
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

    // 开始搜索、暂停/继续、停止搜索等函数保持不变
    // （省略部分重复代码）
    
    function startSearch() {
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
        
        updateStatus("获取热榜中...");
        if (deviceType === 'pc') {
            getPcHotWords().then(words => {
                hotWords = words;
                initSearch();
            });
        } else {
            getMobileHotWords().then(words => {
                hotWords = words;
                initSearch();
            });
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
        // 恢复状态代码保持不变
    });
})();
