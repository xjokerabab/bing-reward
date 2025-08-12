// ==UserScript==
// @name         Bing自动搜索热榜（带手动控制）
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  带手动控制功能的Bing自动搜索脚本，可避免跨域访问提示
// @author       Your Name
// @match        https://www.bing.com/*
// @icon         https://www.bing.com/favicon.ico
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

    // 创建控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.style.position = 'fixed';
        panel.style.top = '20px';
        panel.style.right = '20px';
        panel.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        panel.style.border = '1px solid #ccc';
        panel.style.borderRadius = '8px';
        panel.style.padding = '15px';
        panel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        panel.style.zIndex = '999999';
        panel.style.width = '250px';
        panel.id = 'autoSearchControlPanel';

        // 标题
        const title = document.createElement('h3');
        title.textContent = 'Bing自动搜索控制';
        title.style.margin = '0 0 10px 0';
        title.style.fontSize = '16px';
        title.style.textAlign = 'center';
        panel.appendChild(title);

        // 状态显示
        const statusDiv = document.createElement('div');
        statusDiv.id = 'autoSearchStatus';
        statusDiv.style.margin = '0 0 10px 0';
        statusDiv.style.padding = '8px';
        statusDiv.style.backgroundColor = '#f5f5f5';
        statusDiv.style.borderRadius = '4px';
        statusDiv.style.textAlign = 'center';
        statusDiv.textContent = '未运行';
        panel.appendChild(statusDiv);

        // 进度显示
        const progressDiv = document.createElement('div');
        progressDiv.id = 'autoSearchProgress';
        progressDiv.style.margin = '0 0 15px 0';
        progressDiv.style.textAlign = 'center';
        progressDiv.textContent = '进度: 0/0';
        panel.appendChild(progressDiv);

        // 按钮容器
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.gap = '8px';
        buttonsDiv.style.justifyContent = 'center';

        // 开始按钮
        const startBtn = document.createElement('button');
        startBtn.id = 'startSearchBtn';
        startBtn.textContent = '开始';
        startBtn.style.padding = '6px 12px';
        startBtn.style.backgroundColor = '#4CAF50';
        startBtn.style.color = 'white';
        startBtn.style.border = 'none';
        startBtn.style.borderRadius = '4px';
        startBtn.style.cursor = 'pointer';
        startBtn.addEventListener('click', startSearch);
        buttonsDiv.appendChild(startBtn);

        // 暂停按钮
        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'pauseSearchBtn';
        pauseBtn.textContent = '暂停';
        pauseBtn.style.padding = '6px 12px';
        pauseBtn.style.backgroundColor = '#ff9800';
        pauseBtn.style.color = 'white';
        pauseBtn.style.border = 'none';
        pauseBtn.style.borderRadius = '4px';
        pauseBtn.style.cursor = 'pointer';
        pauseBtn.disabled = true;
        pauseBtn.addEventListener('click', togglePause);
        buttonsDiv.appendChild(pauseBtn);

        // 结束按钮
        const stopBtn = document.createElement('button');
        stopBtn.id = 'stopSearchBtn';
        stopBtn.textContent = '结束';
        stopBtn.style.padding = '6px 12px';
        stopBtn.style.backgroundColor = '#f44336';
        stopBtn.style.color = 'white';
        stopBtn.style.border = 'none';
        stopBtn.style.borderRadius = '4px';
        stopBtn.style.cursor = 'pointer';
        stopBtn.disabled = true;
        stopBtn.addEventListener('click', stopSearch);
        buttonsDiv.appendChild(stopBtn);

        panel.appendChild(buttonsDiv);

        // 添加到页面
        document.body.appendChild(panel);
    }

    // 更新状态显示
    function updateStatus(text) {
        document.getElementById('autoSearchStatus').textContent = text;
    }

    // 更新进度显示
    function updateProgress(current, total) {
        document.getElementById('autoSearchProgress').textContent = `进度: ${current}/${total}`;
    }

    // 检测设备类型（PC或移动设备）
    function detectDeviceType() {
        const userAgent = navigator.userAgent;
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        return mobileRegex.test(userAgent) ? 'mobile' : 'pc';
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
                        
                        const hotWords = Array.from(hotWordElements)
                            .map(el => el.textContent.trim())
                            .filter(word => word.length > 0);
                        
                        if (hotWords.length < 40) {
                            console.log(`仅获取到${hotWords.length}条热词，将重复填充至40条`);
                            while (hotWords.length < 40) {
                                hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 40 - hotWords.length)));
                            }
                        } else {
                            hotWords.splice(40);
                        }
                        
                        console.log(`成功获取百度热榜前40条热词`);
                        resolve(hotWords);
                    } catch (e) {
                        console.error('解析百度热榜失败:', e);
                        const fallbackWords = [
                            "人工智能最新发展", "全球经济趋势", "量子计算突破", "新能源技术", "元宇宙应用",
                            "区块链创新", "5G技术进展", "太空探索新闻", "自动驾驶技术", "大数据分析"
                        ];
                        resolve(fallbackWords);
                    }
                },
                onerror: function(error) {
                    console.error('获取百度热榜失败:', error);
                    const fallbackWords = [
                        "人工智能最新发展", "全球经济趋势", "量子计算突破", "新能源技术", "元宇宙应用",
                        "区块链创新", "5G技术进展", "太空探索新闻", "自动驾驶技术", "大数据分析"
                    ];
                    resolve(fallbackWords);
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
                        
                        const hotWords = Array.from(hotWordElements)
                            .map(el => el.textContent.trim())
                            .filter(word => word.length > 0);
                        
                        if (hotWords.length < 30) {
                            console.log(`仅获取到${hotWords.length}条热词，将重复填充至30条`);
                            while (hotWords.length < 30) {
                                hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 30 - hotWords.length)));
                            }
                        } else {
                            hotWords.splice(30);
                        }
                        
                        console.log(`成功获取今日头条前30条热词`);
                        resolve(hotWords);
                    } catch (e) {
                        console.error('解析今日头条热榜失败:', e);
                        const fallbackWords = [
                            "手机新品发布", "短视频热门挑战", "移动游戏排行", "手机摄影技巧", "流量套餐推荐",
                            "手游攻略", "移动支付安全", "短视频制作教程", "手机性能评测", "充电宝选购"
                        ];
                        resolve(fallbackWords);
                    }
                },
                onerror: function(error) {
                    console.error('获取今日头条热榜失败:', error);
                    const fallbackWords = [
                        "手机新品发布", "短视频热门挑战", "移动游戏排行", "手机摄影技巧", "流量套餐推荐",
                        "手游攻略", "移动支付安全", "短视频制作教程", "手机性能评测", "充电宝选购"
                    ];
                    resolve(fallbackWords);
                }
            });
        });
    }

    // 随机生成指定范围内的整数（秒）
    function getRandomDelay(min, max) {
        if (Math.random() < 0.1) {
            return Math.floor(Math.random() * (max * 2 - min * 1.5 + 1)) + Math.floor(min * 1.5);
        }
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 从数组中随机获取一个元素
    function getRandomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // 模拟人类浏览行为：随机滚动页面
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

    // 模拟人类点击行为：随机点击页面上的元素
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
                    '.b_algo h2 a',  // Bing搜索结果标题
                    '.b_pag a',     // 分页链接
                    '#sb_form_q'    // 搜索框
                ];
                
                const randomSelector = getRandomItem(clickableSelectors);
                const elements = document.querySelectorAll(randomSelector);
                
                if (elements.length > 0) {
                    const randomElement = elements[Math.floor(Math.random() * elements.length)];
                    
                    // 模拟鼠标移动
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

    // 执行搜索
    function performSearch(query) {
        if (isPaused || !isRunning) return;
        
        const searchBox = document.getElementById('sb_form_q');
        if (searchBox) {
            updateStatus(`正在输入搜索词: ${query}`);
            
            // 清空搜索框
            searchBox.value = '';
            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 逐个字符输入
            let i = 0;
            const typeInterval = setInterval(() => {
                if (!isRunning || isPaused) {
                    clearInterval(typeInterval);
                    return;
                }
                
                if (i < query.length) {
                    searchBox.value += query[i];
                    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                    i++;
                } else {
                    clearInterval(typeInterval);
                    // 输入完成后提交
                    setTimeout(() => {
                        if (!isRunning || isPaused) return;
                        
                        if (Math.random() < 0.7) {
                            searchBox.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
                        } else {
                            const searchButton = document.getElementById('sb_form_go') || document.querySelector('input[type="submit"]');
                            if (searchButton) searchButton.click();
                            else window.location.href = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
                        }
                    }, Math.floor(Math.random() * 1500) + 500);
                }
            }, Math.floor(Math.random() * 150) + 50);
        } else {
            const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            window.location.href = searchUrl;
        }
    }

    // 执行一次搜索循环
    async function performSearchCycle() {
        if (!isRunning || isPaused) return;
        
        if (currentSearchCount >= totalSearches) {
            updateStatus(`已完成所有${totalSearches}次搜索任务！`);
            stopSearch();
            alert(`已完成所有${totalSearches}次搜索任务！`);
            return;
        }

        const delaySeconds = getRandomDelay(5, 30);
        console.log(`将在${delaySeconds}秒后进行第${currentSearchCount + 1}次搜索...`);
        updateStatus(`等待下次搜索: ${delaySeconds}秒`);

        // 倒计时更新
        let remaining = delaySeconds;
        countdownInterval = setInterval(() => {
            if (!isRunning || isPaused) {
                clearInterval(countdownInterval);
                return;
            }
            
            updateStatus(`等待下次搜索: ${remaining}秒`);
            remaining--;
            if (remaining < 0) clearInterval(countdownInterval);
        }, 1000);

        // 等待期间模拟人类行为
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

        // 随机选择一个热词并搜索
        const randomWord = getRandomItem(hotWords);
        console.log(`执行第${currentSearchCount + 1}次搜索: ${randomWord}`);
        
        // 更新计数
        currentSearchCount++;
        localStorage.setItem('bingAutoSearchCount', currentSearchCount.toString());
        updateProgress(currentSearchCount, totalSearches);
        
        // 执行搜索
        performSearch(randomWord);
    }

    // 开始搜索
    async function startSearch() {
        if (isRunning) return;
        
        isRunning = true;
        isPaused = false;
        
        // 更新按钮状态
        document.getElementById('startSearchBtn').disabled = true;
        document.getElementById('pauseSearchBtn').disabled = false;
        document.getElementById('stopSearchBtn').disabled = false;
        
        updateStatus("正在准备搜索...");
        
        // 检测设备类型
        deviceType = detectDeviceType();
        console.log(`检测到设备类型: ${deviceType}`);
        
        // 设置参数
        if (deviceType === 'pc') {
            totalSearches = 40;
            updateStatus("正在获取百度热榜...");
            hotWords = await getPcHotWords();
        } else {
            totalSearches = 30;
            updateStatus("正在获取今日头条热榜...");
            hotWords = await getMobileHotWords();
        }
        
        // 获取当前进度
        currentSearchCount = parseInt(localStorage.getItem('bingAutoSearchCount') || '0');
        if (currentSearchCount >= totalSearches) {
            currentSearchCount = 0;
            localStorage.setItem('bingAutoSearchCount', '0');
        }
        
        updateProgress(currentSearchCount, totalSearches);
        updateStatus("准备就绪，开始搜索流程");
        
        // 开始第一次搜索循环
        setTimeout(performSearchCycle, 1000);
    }

    // 暂停/继续搜索
    function togglePause() {
        if (!isRunning) return;
        
        isPaused = !isPaused;
        const pauseBtn = document.getElementById('pauseSearchBtn');
        
        if (isPaused) {
            pauseBtn.textContent = '继续';
            updateStatus("已暂停");
            if (countdownInterval) clearInterval(countdownInterval);
        } else {
            pauseBtn.textContent = '暂停';
            updateStatus("继续搜索流程");
            performSearchCycle();
        }
    }

    // 停止搜索
    function stopSearch() {
        isRunning = false;
        isPaused = false;
        if (countdownInterval) clearInterval(countdownInterval);
        
        // 重置按钮状态
        document.getElementById('startSearchBtn').disabled = false;
        document.getElementById('pauseSearchBtn').disabled = true;
        document.getElementById('stopSearchBtn').disabled = true;
        document.getElementById('pauseSearchBtn').textContent = '暂停';
        
        // 重置进度
        updateStatus("已停止");
        updateProgress(0, 0);
        
        // 可选：保留进度或重置进度
        // localStorage.setItem('bingAutoSearchCount', '0');
        // currentSearchCount = 0;
    }

    // 页面加载完成后创建控制面板
    window.addEventListener('load', () => {
        // 检查是否已存在控制面板，避免重复创建
        if (!document.getElementById('autoSearchControlPanel')) {
            createControlPanel();
        }
    });
})();
