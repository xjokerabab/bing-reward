// ==UserScript==
// @name         Bing自动搜索热词（类人行为模式）
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  识别设备类型，模拟人类行为在Bing上自动搜索热词，降低被识别风险
// @author       Your Name
// @match        https://www.bing.com/*
// @icon         https://www.bing.com/favicon.ico
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

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

    // 随机生成指定范围内的整数（秒），增加一些更自然的波动
    function getRandomDelay(min, max) {
        // 10%的概率会生成更长的延迟，模拟用户中途做其他事情
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
            // 30%的概率执行浏览行为
            if (Math.random() < 0.3) {
                console.log("模拟用户浏览行为...");
                
                // 随机决定滚动次数
                const scrollTimes = Math.floor(Math.random() * 3) + 1;
                let scrollCount = 0;
                
                const scrollInterval = setInterval(() => {
                    // 随机滚动到页面的某个位置
                    const scrollPosition = Math.floor(Math.random() * document.body.scrollHeight * 0.8);
                    window.scrollTo({
                        top: scrollPosition,
                        behavior: 'smooth'
                    });
                    
                    scrollCount++;
                    if (scrollCount >= scrollTimes) {
                        clearInterval(scrollInterval);
                        // 滚动结束后等待一小段时间
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
            // 20%的概率执行点击行为
            if (Math.random() < 0.2) {
                console.log("模拟用户点击行为...");
                
                // 可能点击的元素选择器
                const clickableSelectors = [
                    'a[href]', 
                    'button', 
                    '.b_algo h2 a',  // Bing搜索结果标题
                    '.b_pag a',     // 分页链接
                    '#sb_form_q'    // 搜索框
                ];
                
                // 随机选择一个选择器
                const randomSelector = getRandomItem(clickableSelectors);
                const elements = document.querySelectorAll(randomSelector);
                
                if (elements.length > 0) {
                    // 随机选择一个元素点击
                    const randomElement = elements[Math.floor(Math.random() * elements.length)];
                    
                    // 模拟鼠标移动到元素
                    const rect = randomElement.getBoundingClientRect();
                    const mouseEvent = new MouseEvent('mousemove', {
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top + rect.height / 2,
                        bubbles: true
                    });
                    randomElement.dispatchEvent(mouseEvent);
                    
                    // 短暂延迟后点击
                    setTimeout(() => {
                        randomElement.click();
                        // 如果点击的是搜索结果，等待更长时间
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
        // 模拟用户输入搜索词
        const searchBox = document.getElementById('sb_form_q');
        if (searchBox) {
            // 先清空搜索框
            searchBox.value = '';
            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 逐个字符输入，模拟真实打字
            let i = 0;
            const typeInterval = setInterval(() => {
                if (i < query.length) {
                    searchBox.value += query[i];
                    searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                    i++;
                } else {
                    clearInterval(typeInterval);
                    // 输入完成后等待随机时间再提交
                    setTimeout(() => {
                        // 随机选择按回车或点击搜索按钮
                        if (Math.random() < 0.7) {
                            searchBox.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
                        } else {
                            const searchButton = document.getElementById('sb_form_go') || document.querySelector('input[type="submit"]');
                            if (searchButton) searchButton.click();
                            else window.location.href = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
                        }
                    }, Math.floor(Math.random() * 1500) + 500);
                }
            }, Math.floor(Math.random() * 150) + 50); // 打字速度变化
        } else {
            // 如果找不到搜索框，直接跳转
            const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
            window.location.href = searchUrl;
        }
    }

    // 主函数
    async function startAutoSearch() {
        const deviceType = detectDeviceType();
        console.log(`检测到设备类型: ${deviceType}`);

        let hotWords, totalSearches;
        
        if (deviceType === 'pc') {
            totalSearches = 40;
            showStatusMessage('正在获取百度热榜...', deviceType, 0, totalSearches);
            hotWords = await getPcHotWords();
        } else {
            totalSearches = 30;
            showStatusMessage('正在获取今日头条热榜...', deviceType, 0, totalSearches);
            hotWords = await getMobileHotWords();
        }

        let completedSearches = parseInt(localStorage.getItem('bingAutoSearchCount') || '0');
        console.log(`已完成搜索次数: ${completedSearches}/${totalSearches}`);

        if (completedSearches >= totalSearches) {
            alert(`已完成${totalSearches}次搜索任务！`);
            localStorage.setItem('bingAutoSearchCount', '0');
            return;
        }

        // 显示状态提示
        const statusDiv = document.createElement('div');
        statusDiv.style.position = 'fixed';
        statusDiv.style.top = '20px';
        statusDiv.style.left = '20px';
        statusDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        statusDiv.style.color = 'white';
        statusDiv.style.padding = '10px';
        statusDiv.style.borderRadius = '5px';
        statusDiv.style.zIndex = '99999';
        statusDiv.id = 'autoSearchStatus';
        document.body.appendChild(statusDiv);

        // 生成随机延迟时间（5-30秒）
        const delaySeconds = getRandomDelay(5, 30);
        console.log(`将在${delaySeconds}秒后进行第${completedSearches + 1}次搜索...`);

        // 倒计时更新
        let remaining = delaySeconds;
        const countdownInterval = setInterval(() => {
            statusDiv.textContent = `设备: ${deviceType === 'pc' ? '电脑' : '手机'} | 进度: ${completedSearches + 1}/${totalSearches} | 下次搜索: ${remaining}秒`;
            remaining--;
            if (remaining < 0) clearInterval(countdownInterval);
        }, 1000);

        // 等待期间模拟人类行为
        await new Promise(resolve => setTimeout(resolve, Math.floor(delaySeconds * 1000 * 0.6)));
        await simulateBrowsing();
        await simulateClicking();
        await new Promise(resolve => setTimeout(resolve, Math.floor(delaySeconds * 1000 * 0.4)));

        // 移除状态提示
        document.getElementById('autoSearchStatus')?.remove();

        // 随机选择一个热词并搜索
        const randomWord = getRandomItem(hotWords);
        console.log(`执行搜索: ${randomWord}`);
        
        // 更新已完成搜索次数
        localStorage.setItem('bingAutoSearchCount', (completedSearches + 1).toString());
        
        // 执行搜索
        performSearch(randomWord);
    }

    // 显示状态消息
    function showStatusMessage(message, deviceType, completed, total) {
        const statusDiv = document.createElement('div');
        statusDiv.style.position = 'fixed';
        statusDiv.style.top = '20px';
        statusDiv.style.left = '20px';
        statusDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        statusDiv.style.color = 'white';
        statusDiv.style.padding = '10px';
        statusDiv.style.borderRadius = '5px';
        statusDiv.style.zIndex = '99999';
        statusDiv.id = 'autoSearchStatus';
        statusDiv.textContent = `设备: ${deviceType === 'pc' ? '电脑' : '手机'} | 进度: ${completed}/${total} | ${message}`;
        document.body.appendChild(statusDiv);
    }

    // 当页面加载完成后开始自动搜索流程
    window.addEventListener('load', startAutoSearch);
})();
