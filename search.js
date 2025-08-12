// ==UserScript==
// @name         国内必应自动搜索（优化版）
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  修复进度问题，优化按钮显示，调整等待时间为5-30秒
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
    // 存储当前搜索会话的总搜索数，解决页面刷新后进度问题
    let sessionTotalSearches = 0;

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

        // 状态显示（放大显示）
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

        // 开始按钮（增强视觉效果）
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

        // 暂停按钮（增强视觉效果）
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

        // 结束按钮（增强视觉效果）
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

    // 更新状态显示（增加颜色标识）
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
        // 保存到localStorage，解决页面刷新后进度丢失问题
        localStorage.setItem('bingAutoSearchProgress', JSON.stringify({
            current: current,
            total: total
        }));
    }

    // 检测设备类型
    function detectDeviceType() {
        const userAgent = navigator.userAgent;
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        return mobileRegex.test(userAgent) ? 'mobile' : 'pc';
    }

    // 核心功能：热词智能精简处理
    function optimizeHotWord(word) {
        // 1. 基础清洗：移除首尾空格和特殊符号
        let optimized = word.trim().replace(/^[【】()（）[]]+|[【】()（）[]]+$/g, '');
        
        // 2. 按标点分割，取核心部分（优先保留前半段）
        const separators = /[，,。.？?！!：:;；—-]/;
        if (separators.test(optimized)) {
            const parts = optimized.split(separators);
            optimized = parts[0].trim();
        }
        
        // 3. 控制长度：PC端3-12字，移动端2-10字（符合正常搜索习惯）
        const maxLength = deviceType === 'pc' ? 12 : 10;
        const minLength = deviceType === 'pc' ? 3 : 2;
        
        if (optimized.length > maxLength) {
            // 智能截断：优先在语义停顿处截断
            const cutPoints = [
                optimized.lastIndexOf(' ', maxLength),
                optimized.lastIndexOf('，', maxLength),
                optimized.lastIndexOf('的', maxLength)
            ].filter(pos => pos > minLength);
            
            const cutPos = cutPoints.length > 0 ? Math.max(...cutPoints) : maxLength;
            optimized = optimized.substring(0, cutPos).trim();
        }
        
        // 4. 兜底：确保不短于最小长度
        if (optimized.length < minLength) {
            // 从原词补充内容
            optimized = word.trim().substring(0, maxLength).trim();
        }
        
        return optimized;
    }

    // 从百度热榜获取PC端热词（带精简处理）
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
                        
                        // 提取并精简热词
                        let hotWords = Array.from(hotWordElements)
                            .map(el => el.textContent.trim())
                            .filter(word => word.length > 0)
                            .map(word => optimizeHotWord(word)) // 应用精简处理
                            .filter(word => word.length >= 3); // 过滤过短的词
                        
                        // 确保数量充足
                        if (hotWords.length < 40) {
                            console.log(`百度热榜仅获取到${hotWords.length}条有效热词，补充至40条`);
                            while (hotWords.length < 40) {
                                hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 40 - hotWords.length)));
                            }
                        } else {
                            hotWords = hotWords.slice(0, 40);
                        }
                        
                        console.log("百度热榜精简后热词示例:", hotWords.slice(0, 5));
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

    // 从今日头条获取移动端热词（带精简处理）
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
                        
                        // 提取并精简热词
                        let hotWords = Array.from(hotWordElements)
                            .map(el => el.textContent.trim())
                            .filter(word => word.length > 0)
                            .map(word => optimizeHotWord(word)) // 应用精简处理
                            .filter(word => word.length >= 2); // 过滤过短的词
                        
                        // 确保数量充足
                        if (hotWords.length < 30) {
                            console.log(`今日头条仅获取到${hotWords.length}条有效热词，补充至30条`);
                            while (hotWords.length < 30) {
                                hotWords.push(...hotWords.slice(0, Math.min(hotWords.length, 30 - hotWords.length)));
                            }
                        } else {
                            hotWords = hotWords.slice(0, 30);
                        }
                        
                        console.log("今日头条精简后热词示例:", hotWords.slice(0, 5));
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

    // PC端备用热词（已预先精简）
    function getFallbackPcWords() {
        return [
            "人工智能发展", "全球经济趋势", "量子计算突破", "新能源技术", "元宇宙应用",
            "区块链创新", "5G技术进展", "太空探索", "自动驾驶", "大数据分析",
            "云计算发展", "网络安全动态", "机器学习", "边缘计算", "数字货币",
            "生物科技", "虚拟现实", "增强现实", "物联网", "智能家居",
            "智慧城市", "远程办公", "在线教育", "健康管理", "区块链金融",
            "数字孪生", "机器人自动化", "自然语言处理", "计算机视觉", "可再生能源",
            "碳中和", "半导体技术", "航天发射", "电动汽车", "智能家居设备",
            "AR游戏", "VR医疗", "量子通信", "脑机接口", "纳米技术"
        ];
    }

    // 移动端备用热词（已预先精简）
    function getFallbackMobileWords() {
        return [
            "手机新品", "短视频挑战", "移动游戏排行", "手机摄影", "流量套餐",
            "手游攻略", "移动支付安全", "短视频制作", "手机评测", "充电宝选购",
            "手机壁纸", "直播带货", "移动办公", "手机清理", "短视频规则",
            "手游礼包", "手机维修", "网络加速", "手机续航", "社交软件新功能",
            "手机配件", "移动电竞赛事", "短视频变现", "数据恢复", "移动剪辑",
            "手游内测", "手机散热", "流量节省", "隐私保护", "短视频音乐"
        ];
    }

    // 随机生成延迟时间（5-30秒，已按要求调整）
    function getRandomDelay() {
        // 确保延迟在5-30秒之间
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
                    '.b_algo h2 a',  // 搜索结果标题
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

    // 执行搜索（模拟自然输入）
    function performSearch(query) {
        if (isPaused || !isRunning) return;
        
        const searchBox = document.getElementById('sb_form_q');
        if (searchBox) {
            updateStatus(`搜索中: ${query}`);
            
            // 清空搜索框
            searchBox.value = '';
            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 模拟人类打字（带随机停顿）
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
                    // 输入完成后随机延迟提交
                    setTimeout(() => {
                        if (!isRunning || isPaused) return;
                        
                        if (Math.random() < 0.7) {
                            searchBox.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
                        } else {
                            const searchButton = document.getElementById('sb_form_go') || document.querySelector('input[type="submit"]');
                            if (searchButton) searchButton.click();
                            else window.location.href = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
                        }
                        
                        // 提交后继续搜索循环
                        setTimeout(performSearchCycle, 1000);
                    }, Math.floor(Math.random() * 1500) + 500);
                }
            }, Math.floor(Math.random() * 150) + 50); // 打字速度变化（50-200ms/字符）
        } else {
            // 如果找不到搜索框，直接跳转并设置回调
            const searchUrl = `https://cn.bing.com/search?q=${encodeURIComponent(query)}`;
            window.location.href = searchUrl;
            // 页面加载后继续搜索循环
            setTimeout(performSearchCycle, 3000);
        }
    }

    // 搜索循环
    async function performSearchCycle() {
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
        localStorage.setItem('bingAutoSearchCount', currentSearchCount.toString());
        updateProgress(currentSearchCount, totalSearches);
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
        
        // 恢复进度（从localStorage读取）
        const savedProgress = localStorage.getItem('bingAutoSearchProgress');
        if (savedProgress) {
            const { current, total } = JSON.parse(savedProgress);
            // 只有当总搜索数匹配时才恢复进度
            if (total === totalSearches) {
                currentSearchCount = current;
            } else {
                currentSearchCount = 0;
            }
        } else {
            currentSearchCount = parseInt(localStorage.getItem('bingAutoSearchCount') || '0');
        }
        
        if (currentSearchCount >= totalSearches) {
            currentSearchCount = 0;
            localStorage.setItem('bingAutoSearchCount', '0');
            localStorage.removeItem('bingAutoSearchProgress');
        }
        
        updateProgress(currentSearchCount, totalSearches);
        updateStatus("开始搜索流程");
        
        // 启动第一次搜索
        setTimeout(performSearchCycle, 1000);
    }

    // 暂停/继续
    function togglePause() {
        if (!isRunning) return;
        
        isPaused = !isPaused;
        const pauseBtn = document.getElementById('pauseSearchBtn');
        
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
        
        // 重置按钮状态和样式
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
        // 保存当前进度
        updateProgress(currentSearchCount, sessionTotalSearches || 0);
    }

    // 页面加载时恢复进度显示
    function restoreProgressOnLoad() {
        const savedProgress = localStorage.getItem('bingAutoSearchProgress');
        if (savedProgress) {
            const { current, total } = JSON.parse(savedProgress);
            if (document.getElementById('autoSearchProgress')) {
                document.getElementById('autoSearchProgress').textContent = `进度: ${current}/${total}`;
            }
        }
    }

    // 页面加载完成后初始化
    window.addEventListener('load', () => {
        // 检查是否已存在控制面板，避免重复创建
        if (!document.getElementById('autoSearchControlPanel')) {
            createControlPanel();
        }
        // 恢复进度显示
        restoreProgressOnLoad();
    });
})();
