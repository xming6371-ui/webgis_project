<template>
  <div class="task-management-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">分类分析任务</h2>
      <p class="page-description">智能识别作物类型，分析种植变化趋势</p>
    </div>

    <!-- 作物识别模块 -->
    <el-card shadow="hover" class="module-card classification-module">
      <template #header>
        <div class="module-header">
          <span class="module-title">
            <el-icon><DataAnalysis /></el-icon>
            作物智能识别
          </span>
          <el-tag v-if="batchTasks.length > 0" :type="allTasksCompleted ? 'success' : 'primary'" size="small">
            {{ completedTasksCount }}/{{ batchTasks.length }}
          </el-tag>
        </div>
      </template>

      <div class="classification-with-progress">
        <!-- 左侧：识别操作区 -->
        <div class="classification-main">
          <!-- 快速上手指南 -->
          <el-collapse v-model="classificationGuide" class="guide-section">
            <el-collapse-item name="1">
              <template #title>
                <div class="guide-title">
                  <el-icon><QuestionFilled /></el-icon>
                  <span>快速上手指南</span>
                </div>
              </template>
              <div class="guide-content">
                <div class="guide-step">
                  <div class="step-number">1</div>
                  <div class="step-content">
                    <h4>选择数据来源</h4>
                    <p>支持<strong>本地上传</strong>（批量上传影像+SHP）或<strong>从数据管理上传</strong>（选择已有影像和SHP文件，支持批量配对）</p>
                  </div>
                </div>
                <div class="guide-step">
                  <div class="step-number">2</div>
                  <div class="step-content">
                    <h4>文件配对（本地上传模式）</h4>
                    <p>左侧上传<strong>遥感影像</strong>，右侧上传<strong>SHP文件</strong>（ZIP压缩包），影像和SHP需一一对应</p>
                  </div>
                </div>
                <div class="guide-step">
                  <div class="step-number">3</div>
                  <div class="step-content">
                    <h4>开始识别</h4>
                    <p>点击"开始识别"后，系统调用深度学习模型进行作物分类，右侧会显示每个任务的识别进度</p>
                  </div>
                </div>
                <div class="guide-tips">
                  <el-icon color="#E6A23C"><WarnTriangleFilled /></el-icon>
                  <span><strong>提示：</strong>本地上传模式需确保影像和SHP数量相同且顺序对应。单个任务识别通常需要2-5分钟</span>
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>

          <!-- 数据来源选择 -->
          <el-radio-group v-model="imageSource" class="image-source-selector">
            <el-radio-button label="local">
              <Upload :size="16" style="margin-right: 6px;" />
              本地上传（批量配对）
            </el-radio-button>
            <el-radio-button label="library">
              <el-icon><Folder /></el-icon>
              从数据管理上传（批量配对）
            </el-radio-button>
          </el-radio-group>

          <!-- 本地上传模式：双上传区域 -->
          <div v-if="imageSource === 'local'" class="local-upload-mode">
            <div class="dual-upload-container">
              <!-- 左侧：遥感影像上传 -->
              <div class="upload-section">
                <div class="upload-area" @click="handleImageUpload">
                  <div class="upload-icon">
                    <Upload :size="40" color="#409EFF" />
                  </div>
                  <div class="upload-text">
                    <h3>批量上传遥感影像</h3>
                    <p>支持 TIF、IMG 格式</p>
                  </div>
                  <el-button type="primary" size="default" class="upload-btn">
                    <Upload :size="16" style="margin-right: 6px;" />
                    选择影像文件（可多选）
                  </el-button>
                </div>
                <div v-if="uploadedImages.length > 0" class="file-list">
                  <div class="list-header">
                    <span>已选择 {{ uploadedImages.length }} 个影像</span>
                    <el-button type="danger" size="small" text @click="clearImages">清空</el-button>
                  </div>
                  <div class="file-items">
                    <div v-for="(file, index) in uploadedImages" :key="index" class="file-item">
                      <el-icon><Picture /></el-icon>
                      <span class="file-name">{{ file.name }}</span>
                      <el-tag size="small" type="info">{{ formatFileSize(file.size) }}</el-tag>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 右侧：SHP文件上传 -->
              <div class="upload-section">
                <div class="upload-area" @click="handleShpUpload">
                  <div class="upload-icon">
                    <Upload :size="40" color="#67C23A" />
                  </div>
                  <div class="upload-text">
                    <h3>批量上传SHP文件</h3>
                    <p>仅支持 ZIP 压缩包格式</p>
                  </div>
                  <el-button type="success" size="default" class="upload-btn">
                    <Upload :size="16" style="margin-right: 6px;" />
                    选择压缩包（可多选）
                  </el-button>
                </div>
                <div v-if="uploadedShps.length > 0" class="file-list">
                  <div class="list-header">
                    <span>已选择 {{ uploadedShps.length }} 个SHP</span>
                    <el-button type="danger" size="small" text @click="clearShps">清空</el-button>
                  </div>
                  <div class="file-items">
                    <div v-for="(file, index) in uploadedShps" :key="index" class="file-item">
                      <el-icon><FolderOpened /></el-icon>
                      <span class="file-name">{{ file.name }}</span>
                      <el-tag size="small" type="success">{{ formatFileSize(file.size) }}</el-tag>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 配对状态提示 -->
            <div class="pairing-status">
              <div v-if="uploadedImages.length === 0 && uploadedShps.length === 0" class="status-empty">
                <el-icon><InfoFilled /></el-icon>
                <span>请先上传遥感影像和SHP文件</span>
              </div>
              <div v-else-if="uploadedImages.length !== uploadedShps.length" class="status-warning">
                <el-icon color="#E6A23C"><WarnTriangleFilled /></el-icon>
                <span>影像数量（{{ uploadedImages.length }}）和SHP数量（{{ uploadedShps.length }}）不匹配，请确保数量相同</span>
              </div>
              <div v-else class="status-success">
                <el-icon color="#67C23A"><CircleCheck /></el-icon>
                <span>已配对 {{ uploadedImages.length }} 个任务，可以开始识别</span>
                <el-button 
                  type="primary" 
                  size="default" 
                  @click="handleOpenTaskInfoDialog"
                  style="margin-left: 12px;"
                >
                  <el-icon style="margin-right: 6px;"><DataAnalysis /></el-icon>
                  开始识别
                </el-button>
              </div>
            </div>
          </div>

          <!-- 影像管理模式 -->
          <div v-else class="library-mode">
            <div class="library-dual-select">
              <!-- 左侧：选择影像 -->
              <div class="library-select-section">
                <div class="select-label">
                  <el-icon><Picture /></el-icon>
                  <span>选择遥感影像</span>
                </div>
                <el-select 
                  v-model="selectedLibraryImageIds" 
                  placeholder="从data文件夹选择影像" 
                  size="large"
                  multiple
                  filterable
                  collapse-tags
                  collapse-tags-tooltip
                  class="library-selector"
                >
                  <el-option
                    v-for="img in imageLibrary"
                    :key="img.id"
                    :label="img.name"
                    :value="img.id"
                  >
                    <div class="image-option">
                      <span class="image-name">{{ img.name }}</span>
                      <span class="image-info">{{ img.type }} | {{ img.size }}</span>
                    </div>
                  </el-option>
                </el-select>
                <div class="select-count">已选择 {{ selectedLibraryImageIds.length }} 个影像</div>
              </div>

              <!-- 右侧：选择SHP -->
              <div class="library-select-section">
                <div class="select-label">
                  <el-icon><FolderOpened /></el-icon>
                  <span>选择SHP文件</span>
                </div>
                <el-select 
                  v-model="selectedLibraryShpIds" 
                  placeholder="从data_shp文件夹选择SHP" 
                  size="large"
                  multiple
                  filterable
                  collapse-tags
                  collapse-tags-tooltip
                  class="library-selector"
                >
                  <el-option
                    v-for="shp in shpLibrary"
                    :key="shp.id"
                    :label="shp.name"
                    :value="shp.id"
                  >
                    <div class="image-option">
                      <span class="image-name">{{ shp.name }}</span>
                      <span class="image-info">{{ shp.regionName || 'SHP' }} | {{ shp.size }}</span>
                    </div>
                  </el-option>
                </el-select>
                <div class="select-count">已选择 {{ selectedLibraryShpIds.length }} 个SHP</div>
              </div>
            </div>

            <!-- 配对状态 -->
            <div class="library-pairing-status">
              <div v-if="selectedLibraryImageIds.length === 0 && selectedLibraryShpIds.length === 0" class="status-empty">
                <el-icon><InfoFilled /></el-icon>
                <span>请从data文件夹中选择影像和SHP文件</span>
              </div>
              <div v-else-if="selectedLibraryImageIds.length !== selectedLibraryShpIds.length" class="status-warning">
                <el-icon color="#E6A23C"><WarnTriangleFilled /></el-icon>
                <span>影像数量（{{ selectedLibraryImageIds.length }}）和SHP数量（{{ selectedLibraryShpIds.length }}）不匹配</span>
              </div>
              <div v-else class="status-success">
                <el-icon color="#67C23A"><CircleCheck /></el-icon>
                <span>已配对 {{ selectedLibraryImageIds.length }} 个任务，可以开始识别</span>
                <el-button 
                  type="primary" 
                  size="default"
                  @click="handleOpenLibraryTaskInfoDialog"
                >
                  <el-icon style="margin-right: 8px;"><DataAnalysis /></el-icon>
                  开始识别
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：批量识别进度面板 -->
        <div class="progress-sidebar">
          <div class="progress-header">
            <span class="progress-title">
              <el-icon><Histogram /></el-icon>
              识别进度
            </span>
          </div>

          <div class="progress-content">
            <el-empty 
              v-if="batchTasks.length === 0" 
              description="暂无任务"
              :image-size="80"
            />
            
            <div v-else class="task-list">
              <div 
                v-for="task in batchTasks" 
                :key="task.id" 
                class="task-item"
                :class="{ 'task-completed': task.status === 'completed', 'task-processing': task.status === 'processing' }"
              >
                <div class="task-header">
                  <div class="task-name">
                    <el-icon v-if="task.status === 'completed'" color="#67C23A" :size="16"><CircleCheck /></el-icon>
                    <el-icon v-else-if="task.status === 'processing'" class="rotating" color="#409EFF" :size="16"><Loading /></el-icon>
                    <el-icon v-else color="#909399" :size="16"><Clock /></el-icon>
                    <span>任务 {{ task.taskNumber }}</span>
                  </div>
                  <el-tag :type="getTaskStatusType(task.status)" size="small">
                    {{ getTaskStatusText(task.status) }}
                  </el-tag>
                </div>
                
                <!-- 文件配对信息 -->
                <div class="task-files">
                  <div class="file-pair">
                    <el-icon color="#409EFF"><Picture /></el-icon>
                    <span class="file-pair-name">{{ task.imageName }}</span>
                  </div>
                  <div class="file-pair">
                    <el-icon color="#67C23A"><FolderOpened /></el-icon>
                    <span class="file-pair-name">{{ task.shpName }}</span>
                  </div>
                </div>
                
                <el-progress 
                  :percentage="task.progress" 
                  :status="task.status === 'completed' ? 'success' : ''"
                  :stroke-width="6"
                  :show-text="false"
                />
                
                <div class="task-info">
                  <span class="task-progress-text">{{ task.statusText }}</span>
                  <span class="task-time">{{ task.elapsedTime }}</span>
                </div>
              </div>
            </div>

            <div v-if="batchTasks.length > 0 && allTasksCompleted" class="batch-summary">
              <el-alert type="success" :closable="false" class="compact-alert">
                <template #title>
                  <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
                    <el-icon :size="16"><SuccessFilled /></el-icon>
                    <span>全部完成！</span>
                  </div>
                </template>
              </el-alert>
              <el-button 
                type="primary" 
                size="small" 
                @click="handleClearBatchTasks"
                style="margin-top: 8px; width: 100%;"
              >
                清空列表
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 变化检测与差异分析模块 -->
    <el-card shadow="never" class="module-card analysis-module">
      <template #header>
        <div class="module-header">
          <span class="module-title">
            <GitCompare :size="18" style="margin-right: 8px;" />
            变化检测与差异分析
          </span>
        </div>
      </template>

      <!-- 快速上手指南 -->
      <el-collapse v-model="analysisGuide" class="guide-section" style="margin-bottom: 20px;">
        <el-collapse-item name="1">
          <template #title>
            <div class="guide-title">
              <el-icon><QuestionFilled /></el-icon>
              <span>快速上手指南</span>
            </div>
          </template>
          <div class="guide-content">
            <div class="guide-step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h4>完成作物识别</h4>
                <p>在上方"作物智能识别"模块中，完成影像识别任务，系统会自动保存识别结果到分析队列</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">2</div>
              <div class="step-content">
                <h4>选择分析类型</h4>
                <p><strong>种植差异检测：</strong>对比2期识别结果，查看作物类型变化<br/>
                <strong>时序变化分析：</strong>对比多期（2期以上）识别结果，追踪作物种植轨迹</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="step-number">3</div>
              <div class="step-content">
                <h4>查看分析结果</h4>
                <p>分析完成后，系统会自动跳转到"结果对比"页面，展示差异地图、统计图表和变化轨迹</p>
              </div>
            </div>
            <div class="guide-tips">
              <el-icon color="#E6A23C"><WarnTriangleFilled /></el-icon>
              <span><strong>提示：</strong>进行差异分析前，请确保已有至少2个识别结果。时序分析需要至少2期数据</span>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>

      <!-- 功能按钮区 -->
      <div class="analysis-actions">
        <el-card shadow="hover" class="action-card" @click="showDifferenceDialog = true">
          <div class="action-content">
            <el-icon class="action-icon" color="#E6A23C"><Location /></el-icon>
            <div class="action-text">
              <div class="action-title">种植差异检测</div>
              <div class="action-desc">对比不同时期的作物种植差异</div>
            </div>
          </div>
        </el-card>

        <el-card shadow="hover" class="action-card" @click="showTemporalDialog = true">
          <div class="action-content">
            <el-icon class="action-icon" color="#409EFF"><DataAnalysis /></el-icon>
            <div class="action-text">
              <div class="action-title">时序变化分析</div>
              <div class="action-desc">追踪多期作物种植变化轨迹</div>
            </div>
          </div>
        </el-card>
          </div>
        </el-card>

    <!-- 种植差异检测配置对话框 -->
    <el-dialog
      v-model="showDifferenceDialog"
      title="种植差异检测配置"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="说明"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        从识别结果队列中选择两个<strong>相同格式</strong>的识别结果文件进行对比（SHP vs SHP 或 GeoJSON vs GeoJSON），时间早的作为原始图，时间晚的作为对比图
      </el-alert>
      
      <el-form :model="differenceConfig" label-width="100px">
        <el-form-item label="原始图" required>
          <el-select 
            v-model="differenceConfig.baseFileId" 
            placeholder="选择时间较早的识别结果" 
            style="width: 100%"
            filterable
            @change="handleBaseFileChange"
          >
            <el-option 
              v-for="file in recognitionFiles" 
              :key="file.id"
              :label="`${file.taskName} (${file.createTime})`" 
              :value="file.id"
              :disabled="file.id === differenceConfig.compareFileId"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="flex: 1;">{{ file.taskName }}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <el-tag :type="file.type === 'SHP' ? 'warning' : 'success'" size="small">{{ file.type }}</el-tag>
                  <span style="color: #8492a6; font-size: 12px;">{{ file.createTime }}</span>
                </div>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item label="对比图" required>
          <el-select 
            v-model="differenceConfig.compareFileId" 
            placeholder="选择时间较晚的识别结果" 
            style="width: 100%"
            filterable
          >
            <el-option 
              v-for="file in getCompatibleFiles(differenceConfig.baseFileId)" 
              :key="file.id"
              :label="`${file.taskName} (${file.createTime})`" 
              :value="file.id"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="flex: 1;">{{ file.taskName }}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <el-tag :type="file.type === 'SHP' ? 'warning' : 'success'" size="small">{{ file.type }}</el-tag>
                  <span style="color: #8492a6; font-size: 12px;">{{ file.createTime }}</span>
                </div>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        
        <el-alert
          v-if="differenceConfig.baseFileId && getSelectedFileType(differenceConfig.baseFileId)"
          :title="`已选择${getSelectedFileType(differenceConfig.baseFileId)}格式，对比图将自动过滤为相同格式`"
          type="warning"
          :closable="false"
          style="margin-top: 12px;"
        />

        <el-divider />

        <el-form-item label="分析名称">
          <el-input 
            v-model="differenceConfig.analysisName" 
            placeholder="选填：系统将自动生成默认名称"
            clearable
          />
        </el-form-item>

        <el-form-item label="备注">
          <el-input 
            v-model="differenceConfig.notes" 
            type="textarea"
            :rows="2"
            placeholder="选填：可以添加分析相关说明"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDifferenceDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleRunDifferenceDetection" 
          :loading="differenceLoading"
          :disabled="!differenceConfig.baseFileId || !differenceConfig.compareFileId"
        >
          开始检测
        </el-button>
      </template>
    </el-dialog>

    <!-- 时序变化分析配置对话框 -->
    <el-dialog
      v-model="showTemporalDialog"
      title="时序变化分析配置"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="说明"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        从分析结果队列中选择多个<strong>相同格式</strong>的识别结果文件进行时序变化分析（至少2个），系统将按时间顺序自动排列
      </el-alert>
      
      <el-form :model="temporalConfig" label-width="120px">
        <el-form-item label="文件格式">
          <el-radio-group v-model="temporalConfig.selectedFormat" @change="handleTemporalFormatChange">
            <el-radio-button label="SHP">SHP格式</el-radio-button>
            <el-radio-button label="GeoJSON">GeoJSON格式</el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="选择文件">
          <el-select 
            v-model="temporalConfig.selectedFileIds" 
            placeholder="选择多个识别结果（至少2个）" 
            style="width: 100%"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
          >
            <el-option 
              v-for="file in getTemporalCompatibleFiles()" 
              :key="file.id"
              :label="`${file.taskName} (${file.createTime})`" 
              :value="file.id"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="flex: 1;">{{ file.taskName }}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <el-tag :type="file.type === 'SHP' ? 'warning' : 'success'" size="small">{{ file.type }}</el-tag>
                  <span style="color: #8492a6; font-size: 12px;">{{ file.createTime }}</span>
                </div>
              </div>
            </el-option>
          </el-select>
          <div style="margin-top: 8px; font-size: 12px; color: #909399;">
            已选择 {{ temporalConfig.selectedFileIds.length }} 个{{ temporalConfig.selectedFormat }}文件
          </div>
        </el-form-item>

        <el-divider />

        <el-form-item label="分析名称">
          <el-input 
            v-model="temporalConfig.analysisName" 
            placeholder="选填：系统将自动生成默认名称"
            clearable
          />
        </el-form-item>

        <el-form-item label="备注">
          <el-input 
            v-model="temporalConfig.notes" 
            type="textarea"
            :rows="2"
            placeholder="选填：可以添加分析相关说明"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTemporalDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleRunTemporalAnalysis" 
          :loading="temporalLoading"
          :disabled="temporalConfig.selectedFileIds.length < 2"
        >
          开始分析
        </el-button>
      </template>
    </el-dialog>

    <!-- 任务信息填写对话框 -->
    <el-dialog
      v-model="showTaskInfoDialog"
      :title="getTaskInfoDialogTitle()"
      width="600px"
      :close-on-click-modal="false"
      @close="handleTaskInfoDialogClose"
    >
      <el-alert
        v-if="(uploadedImages.length > 1 && imageSource === 'local') || (selectedLibraryImageIds.length > 1 && imageSource === 'library')"
        :title="`当前为第 ${currentBatchIndex + 1} 个任务填写信息`"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #default>
          <div style="font-size: 13px; margin-top: 8px;">
            <div v-if="imageSource === 'local'" style="margin-bottom: 6px;">
              <strong>影像文件：</strong>{{ uploadedImages[currentBatchIndex]?.name }}
            </div>
            <div v-else-if="imageSource === 'library'" style="margin-bottom: 6px;">
              <strong>影像文件：</strong>{{ getLibraryImageName(currentBatchIndex) }}
            </div>
            <div v-if="imageSource === 'local'">
              <strong>SHP文件：</strong>{{ uploadedShps[currentBatchIndex]?.name }}
            </div>
            <div v-else-if="imageSource === 'library'">
              <strong>SHP文件：</strong>{{ getLibraryShpName(currentBatchIndex) }}
            </div>
          </div>
        </template>
      </el-alert>

      <el-form :model="taskInfoForm" label-width="80px" size="default">
        <el-form-item label="任务名称" required>
          <el-input 
            v-model="taskInfoForm.taskName" 
            placeholder="请输入任务名称"
            clearable
          />
        </el-form-item>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="年份" required>
              <el-input-number 
                v-model="taskInfoForm.year" 
                :min="2000" 
                :max="2100"
                controls-position="right"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="期次" required>
              <el-input-number 
                v-model="taskInfoForm.period" 
                :min="1" 
                :max="12"
                controls-position="right"
                style="width: 100%;"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="识别任务" required>
          <el-select 
            v-model="taskInfoForm.recognitionType" 
            placeholder="请选择识别任务类型"
            style="width: 100%;"
          >
            <el-option label="作物识别" value="作物识别" />
            <el-option label="种植情况识别" value="种植情况识别" />
          </el-select>
        </el-form-item>

        <el-form-item label="备注">
          <el-input 
            v-model="taskInfoForm.notes" 
            type="textarea"
            :rows="3"
            placeholder="选填：可以添加任务相关说明"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <!-- 批量任务时显示"应用到所有"选项 -->
        <el-form-item v-if="getTotalTaskCount() > 1 && currentBatchIndex === 0">
          <el-checkbox v-model="applyToAll">
            应用相同信息到所有 {{ getTotalTaskCount() }} 个任务（仅任务名称会自动编号）
          </el-checkbox>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="handleCancelTaskInfo">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleConfirmTaskInfo"
          :disabled="!taskInfoForm.taskName"
        >
          {{ currentBatchIndex < getTotalTaskCount() - 1 ? '下一个' : '确定并开始识别' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 分析进度对话框 -->
    <el-dialog
      v-model="analysisTaskRunning"
      title="分析执行中"
      width="500px"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <div class="analysis-progress-dialog">
        <el-progress 
          type="circle" 
          :percentage="analysisProgress" 
          :status="analysisProgress === 100 ? 'success' : ''"
          :width="120"
        />
        <div class="progress-text">{{ analysisStatusText }}</div>
        <el-button 
          v-if="analysisProgress === 100" 
          type="primary" 
          @click="handleViewAnalysisQueue"
        >
          前往查看结果
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import {
  Upload, GitCompare
} from 'lucide-vue-next'
import {
  Tickets, DataAnalysis, Location, InfoFilled, Folder, QuestionFilled,
  WarnTriangleFilled, Histogram, CircleCheck, Loading, Clock, SuccessFilled,
  Picture, FolderOpened
} from '@element-plus/icons-vue'
import { getRecognitionResults, readGeojsonContent, saveAnalysisResultToServer } from '@/api/analysis'
import { useAnalysisStore } from '@/stores/analysis'
import { buildTemporalTrajectories } from '@/utils/temporalAnalysis'

const router = useRouter()
const analysisStore = useAnalysisStore()

// 使用教程折叠状态
const classificationGuide = ref([])
const analysisGuide = ref([])

// 对话框显示状态
const showDifferenceDialog = ref(false)
const showTemporalDialog = ref(false)

// 分析任务执行状态
const analysisTaskRunning = ref(false)
const analysisProgress = ref(0)
const analysisStatusText = ref('')

// 识别结果文件列表（从数据管理模块的分析结果队列加载）
const recognitionFiles = ref([])

// 影像来源选择
const imageSource = ref('local') // local: 本地上传, library: 影像管理
const imageLibrary = ref([]) // 影像管理中的影像列表
const shpLibrary = ref([]) // 影像管理中的SHP列表

// 本地上传模式的文件列表
const uploadedImages = ref([]) // 遥感影像文件列表
const uploadedShps = ref([]) // SHP文件列表（zip格式）

// 影像管理模式的选择
const selectedLibraryImageIds = ref([]) // 选择的影像ID
const selectedLibraryShpIds = ref([]) // 选择的SHP ID

// 批量识别任务列表
const batchTasks = ref([])
let taskIdCounter = 0

// 任务信息对话框
const showTaskInfoDialog = ref(false)
const currentBatchIndex = ref(0) // 当前填写的批次索引
const batchTaskInfos = ref([]) // 批量任务信息列表
const applyToAll = ref(false) // 是否应用到所有任务

// 当前任务信息表单
const taskInfoForm = ref({
  taskName: '',
  year: new Date().getFullYear(),
  period: 1,
  recognitionType: '作物识别',  // 默认为作物识别
  notes: ''
})

// 差异检测配置
const differenceLoading = ref(false)
const differenceConfig = ref({
  baseFileId: '',
  compareFileId: '',
  analysisName: '',
  notes: ''
})

// 时序变化分析配置
const temporalLoading = ref(false)
const temporalConfig = ref({
  selectedFileIds: [],
  selectedFormat: 'SHP', // 默认选择SHP格式
  analysisName: '',
  notes: ''
})

// 计算属性：判断是否有分析数据（通过 store 判断）
// const hasAnalysisData = computed(() => {
//   return analysisStore.differenceResult !== null || 
//          analysisStore.temporalResult !== null
// })

// 批量任务相关计算属性
const completedTasksCount = computed(() => {
  return batchTasks.value.filter(task => task.status === 'completed').length
})

const allTasksCompleted = computed(() => {
  return batchTasks.value.length > 0 && batchTasks.value.every(task => task.status === 'completed')
})

// 获取任务状态显示文本
const getTaskStatusText = (status) => {
  const statusMap = {
    'waiting': '等待中',
    'processing': '识别中',
    'completed': '已完成',
    'failed': '失败'
  }
  return statusMap[status] || '未知'
}

// 获取任务状态标签类型
const getTaskStatusType = (status) => {
  const typeMap = {
    'waiting': 'info',
    'processing': 'primary',
    'completed': 'success',
    'failed': 'danger'
  }
  return typeMap[status] || 'info'
}

// 加载识别结果文件列表（从后端API读取SHP和GeoJSON文件）
const loadRecognitionFiles = async () => {
  try {
    // 从后端API加载识别结果
    const response = await getRecognitionResults()
    if (response.code === 200) {
      const allResults = response.data || []
      
      // 🔧 修复：同时加载 SHP 和 GeoJSON 类型的识别结果文件
      recognitionFiles.value = allResults.filter(r => {
        // 检查文件类型是否为 SHP、GeoJSON 或 GEOJSON（不区分大小写）
        const type = r.type && r.type.toUpperCase()
        return type === 'SHP' || type === 'GEOJSON'
      })
      
      console.log('✅ 已从后端加载识别结果文件:', recognitionFiles.value.length, '个')
      console.log('  - SHP文件:', recognitionFiles.value.filter(r => r.type === 'SHP').length, '个')
      console.log('  - GeoJSON文件:', recognitionFiles.value.filter(r => r.type === 'GeoJSON').length, '个')
      console.log('识别结果文件列表:', recognitionFiles.value)
    } else {
      recognitionFiles.value = []
      console.log('后端返回数据为空')
    }
  } catch (error) {
    console.error('❌ 从后端加载识别结果文件失败:', error)
    recognitionFiles.value = []
  }
}

// 加载影像管理数据（从本地data文件夹）
const loadImageLibrary = async () => {
  try {
    // 从后端API加载data文件夹中的影像列表
    const { getImageList } = await import('@/api/image')
    const response = await getImageList()
    
    if (response.code === 200 && response.data) {
      // 过滤出TIF和IMG格式的影像文件
      imageLibrary.value = response.data
        .filter(img => {
          const ext = img.name?.toLowerCase()
          return ext?.endsWith('.tif') || ext?.endsWith('.tiff') || ext?.endsWith('.img')
        })
        .map(img => ({
          id: img.id,
          name: img.name,
          type: img.type || 'TIF',
          size: img.size || '未知',
          path: img.path,
          uploadTime: img.uploadTime || img.createTime
        }))
      
      console.log('✅ 已从data文件夹加载影像列表:', imageLibrary.value.length, '个')
      console.log('影像列表:', imageLibrary.value)
    } else {
      imageLibrary.value = []
      console.log('⚠️ data文件夹中暂无影像文件')
    }
  } catch (error) {
    console.error('❌ 加载data文件夹影像列表失败:', error)
    imageLibrary.value = []
    ElMessage.warning('无法加载影像列表，请检查后端服务')
  }
}

// 加载SHP库（从data_shp文件夹）
const loadShpLibrary = async () => {
  try {
    // 从后端API加载识别结果（包含SHP文件）
    const response = await getRecognitionResults()
    if (response.code === 200) {
      const allResults = response.data || []
      
      // 只加载SHP类型的文件
      shpLibrary.value = allResults
        .filter(r => r.type === 'SHP')
        .map(shp => ({
          id: shp.id,
          name: shp.name,
          type: 'SHP',
          size: shp.size,
          relativePath: shp.relativePath,
          regionCode: shp.regionCode,
          regionName: shp.regionName,
          taskName: shp.taskName
        }))
      
      console.log('✅ 已从data_shp文件夹加载SHP列表:', shpLibrary.value.length, '个')
      console.log('SHP列表:', shpLibrary.value)
    } else {
      shpLibrary.value = []
      console.log('⚠️ data_shp文件夹中暂无SHP文件')
    }
  } catch (error) {
    console.error('❌ 加载data_shp文件夹SHP列表失败:', error)
    shpLibrary.value = []
    ElMessage.warning('无法加载SHP列表，请检查后端服务')
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadRecognitionFiles()
  loadImageLibrary()
  loadShpLibrary()
})

// 组件卸载时清空已填写的任务信息
onBeforeUnmount(() => {
  // 清空上传的文件和任务信息
  uploadedImages.value = []
  uploadedShps.value = []
  batchTaskInfos.value = []
  currentBatchIndex.value = 0
  applyToAll.value = false
})

// 前往数据管理查看分析结果
const handleViewAnalysisQueue = () => {
  router.push('/image-management')
}

// 获取兼容的文件列表（差异检测用）
const getCompatibleFiles = (baseFileId) => {
  if (!baseFileId) {
    return recognitionFiles.value
  }
  
  const baseFile = recognitionFiles.value.find(f => f.id === baseFileId)
  if (!baseFile) {
    return recognitionFiles.value
  }
  
  // 只返回相同类型且不是原始图的文件
  return recognitionFiles.value.filter(f => 
    f.id !== baseFileId && f.type === baseFile.type
  )
}

// 获取选中文件的类型
const getSelectedFileType = (fileId) => {
  const file = recognitionFiles.value.find(f => f.id === fileId)
  return file ? file.type : null
}

// 原始图选择变化时，清空对比图选择
const handleBaseFileChange = () => {
  differenceConfig.value.compareFileId = ''
}

// 获取时序分析兼容的文件列表
const getTemporalCompatibleFiles = () => {
  return recognitionFiles.value.filter(f => f.type === temporalConfig.value.selectedFormat)
}

// 时序分析格式变化时，清空已选文件
const handleTemporalFormatChange = () => {
  temporalConfig.value.selectedFileIds = []
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 上传遥感影像
const handleImageUpload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.tif,.tiff,.img'
  input.multiple = true
  
  input.onchange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      // 验证文件格式
      const invalidFiles = files.filter(file => {
        const ext = file.name.toLowerCase()
        return !ext.endsWith('.tif') && !ext.endsWith('.tiff') && !ext.endsWith('.img')
      })
      
      if (invalidFiles.length > 0) {
        ElMessage.warning(`以下文件格式不支持：${invalidFiles.map(f => f.name).join(', ')}`)
        return
      }
      
      uploadedImages.value.push(...files)
      ElMessage.success(`已添加 ${files.length} 个遥感影像`)
      console.log('已上传影像文件:', uploadedImages.value)
    }
  }
  
  input.click()
}

// 上传SHP文件
const handleShpUpload = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.zip'
  input.multiple = true
  
  input.onchange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      // 验证文件格式
      const invalidFiles = files.filter(file => !file.name.toLowerCase().endsWith('.zip'))
      
      if (invalidFiles.length > 0) {
        ElMessage.warning(`SHP文件必须打包为ZIP压缩包格式，以下文件格式不支持：${invalidFiles.map(f => f.name).join(', ')}`)
        return
      }
      
      // TODO: 这里可以添加验证zip包内是否只有一个shp文件的逻辑
      // 由于前端无法直接解压zip，这个验证可能需要在后端完成
      
      uploadedShps.value.push(...files)
      ElMessage.success(`已添加 ${files.length} 个SHP压缩包`)
      
      ElNotification({
        title: '提示',
        message: '请确保每个ZIP压缩包仅包含一个SHP文件及其相关文件（.shx, .dbf, .prj等）',
        type: 'info',
        duration: 6000
      })
      
      console.log('已上传SHP文件:', uploadedShps.value)
    }
  }
  
  input.click()
}

// 清空影像列表
const clearImages = () => {
  uploadedImages.value = []
  ElMessage.info('已清空影像列表')
}

// 清空SHP列表
const clearShps = () => {
  uploadedShps.value = []
  ElMessage.info('已清空SHP列表')
}

// 获取总任务数
const getTotalTaskCount = () => {
  if (imageSource.value === 'local') {
    return uploadedImages.value.length
  } else {
    return selectedLibraryImageIds.value.length
  }
}

// 获取任务信息对话框标题
const getTaskInfoDialogTitle = () => {
  const totalCount = getTotalTaskCount()
  if (totalCount > 1) {
    return `填写任务信息 (${currentBatchIndex.value + 1}/${totalCount})`
  }
  return '填写任务信息'
}

// 获取库中影像名称
const getLibraryImageName = (index) => {
  if (index >= selectedLibraryImageIds.value.length) return ''
  const imageId = selectedLibraryImageIds.value[index]
  const image = imageLibrary.value.find(img => img.id === imageId)
  return image ? image.name : ''
}

// 获取库中SHP名称
const getLibraryShpName = (index) => {
  if (index >= selectedLibraryShpIds.value.length) return ''
  const shpId = selectedLibraryShpIds.value[index]
  const shp = shpLibrary.value.find(s => s.id === shpId)
  return shp ? shp.name : ''
}

// 打开任务信息对话框（本地上传模式）
const handleOpenTaskInfoDialog = () => {
  if (uploadedImages.value.length === 0 || uploadedShps.value.length === 0) {
    ElMessage.warning('请先上传遥感影像和SHP文件')
    return
  }
  
  if (uploadedImages.value.length !== uploadedShps.value.length) {
    ElMessage.warning('影像和SHP文件数量必须相同，请检查后重试')
    return
  }
  
  // 重置状态
  currentBatchIndex.value = 0
  batchTaskInfos.value = []
  applyToAll.value = false
  
  // 重置表单
  taskInfoForm.value = {
    taskName: '',
    year: new Date().getFullYear(),
    period: 1,
    recognitionType: '作物识别',
    notes: ''
  }
  
  showTaskInfoDialog.value = true
}

// 打开任务信息对话框（库模式）
const handleOpenLibraryTaskInfoDialog = () => {
  if (selectedLibraryImageIds.value.length === 0 || selectedLibraryShpIds.value.length === 0) {
    ElMessage.warning('请选择影像和SHP文件')
    return
  }
  
  if (selectedLibraryImageIds.value.length !== selectedLibraryShpIds.value.length) {
    ElMessage.warning('影像和SHP文件数量必须相同')
    return
  }
  
  // 重置状态
  currentBatchIndex.value = 0
  batchTaskInfos.value = []
  applyToAll.value = false
  
  // 重置表单
  taskInfoForm.value = {
    taskName: '',
    year: new Date().getFullYear(),
    period: 1,
    recognitionType: '作物识别',
    notes: ''
  }
  
  showTaskInfoDialog.value = true
}

// 确认任务信息
const handleConfirmTaskInfo = () => {
  if (!taskInfoForm.value.taskName) {
    ElMessage.warning('请填写任务名称')
    return
  }
  
  // 保存当前任务信息
  const taskInfo = {
    taskName: taskInfoForm.value.taskName,
    year: taskInfoForm.value.year,
    period: taskInfoForm.value.period,
    notes: taskInfoForm.value.notes
  }
  
  batchTaskInfos.value[currentBatchIndex.value] = taskInfo
  
  const totalTaskCount = getTotalTaskCount()
  
  // 如果选择了"应用到所有"
  if (applyToAll.value && currentBatchIndex.value === 0) {
    // 为所有任务应用相同信息，但任务名称自动编号
    for (let i = 0; i < totalTaskCount; i++) {
      batchTaskInfos.value[i] = {
        ...taskInfo,
        taskName: totalTaskCount > 1 ? `${taskInfo.taskName}_${i + 1}` : taskInfo.taskName
      }
    }
    
    // 直接开始识别
    showTaskInfoDialog.value = false
    if (imageSource.value === 'local') {
      handleStartClassification()
    } else {
      handleLibraryBatchClassify()
    }
    return
  }
  
  // 检查是否还有未填写的任务
  if (currentBatchIndex.value < totalTaskCount - 1) {
    // 继续下一个任务
    currentBatchIndex.value++
    
    // 重置表单（保留年份期次和识别任务）
    taskInfoForm.value = {
      taskName: '',
      year: taskInfoForm.value.year,
      period: taskInfoForm.value.period,
      recognitionType: taskInfoForm.value.recognitionType,
      notes: ''
    }
  } else {
    // 所有任务信息填写完毕，开始识别
    showTaskInfoDialog.value = false
    if (imageSource.value === 'local') {
      handleStartClassification()
    } else {
      handleLibraryBatchClassify()
    }
  }
}

// 取消任务信息填写（直接关闭，保留已填写信息）
const handleCancelTaskInfo = () => {
  showTaskInfoDialog.value = false
}

// 对话框关闭事件（点击右上角×或按ESC）
const handleTaskInfoDialogClose = () => {
  // 关闭时保留已填写的信息，不做清空操作
}

// 开始识别（使用已填写的任务信息）
const handleStartClassification = () => {
  // 创建配对任务，包含任务信息
  const newTasks = []
  for (let i = 0; i < uploadedImages.value.length; i++) {
    const taskInfo = batchTaskInfos.value[i] || {
      taskName: `任务_${i + 1}`,
      year: new Date().getFullYear(),
      period: 1,
      notes: ''
    }
    
    newTasks.push({
      id: `task_${++taskIdCounter}`,
      taskNumber: i + 1,
      imageName: uploadedImages.value[i].name,
      shpName: uploadedShps.value[i].name,
      imageFile: uploadedImages.value[i],
      shpFile: uploadedShps.value[i],
      status: 'waiting',
      progress: 0,
      statusText: '等待处理',
      elapsedTime: '00:00',
      startTime: null,
      // 任务元信息
      taskInfo: taskInfo
    })
  }
  
  batchTasks.value.push(...newTasks)
  
  ElMessage.success(`已创建 ${newTasks.length} 个识别任务，开始批量处理`)
  console.log('📝 批量任务信息:', batchTaskInfos.value)
  
  // 清空上传列表和任务信息
  uploadedImages.value = []
  uploadedShps.value = []
  batchTaskInfos.value = []
  
  // 开始处理批量任务
  processBatchTasks()
}

// 从影像管理批量识别（支持影像+SHP配对）
const handleLibraryBatchClassify = () => {
  if (selectedLibraryImageIds.value.length === 0 || selectedLibraryShpIds.value.length === 0) {
    ElMessage.warning('请选择影像和SHP文件')
    return
  }
  
  if (selectedLibraryImageIds.value.length !== selectedLibraryShpIds.value.length) {
    ElMessage.warning('影像和SHP文件数量必须相同')
    return
  }
  
  const selectedImages = imageLibrary.value.filter(img => 
    selectedLibraryImageIds.value.includes(img.id)
  )
  
  const selectedShps = shpLibrary.value.filter(shp => 
    selectedLibraryShpIds.value.includes(shp.id)
  )
  
  console.log(`从数据管理选择 ${selectedImages.length} 个影像和 ${selectedShps.length} 个SHP`)
  
  // 创建配对任务，包含任务信息
  const newTasks = []
  for (let i = 0; i < selectedImages.length; i++) {
    const taskInfo = batchTaskInfos.value[i] || {
      taskName: `任务_${i + 1}`,
      year: new Date().getFullYear(),
      period: 1,
      notes: ''
    }
    
    newTasks.push({
      id: `task_${++taskIdCounter}`,
      taskNumber: batchTasks.value.length + i + 1,
      imageName: selectedImages[i].name,
      shpName: selectedShps[i].name,
      imageId: selectedImages[i].id,
      shpId: selectedShps[i].id,
      shpRelativePath: selectedShps[i].relativePath,
      status: 'waiting',
      progress: 0,
      statusText: '等待处理',
      elapsedTime: '00:00',
      startTime: null,
      // 任务元信息
      taskInfo: taskInfo
    })
  }
  
  batchTasks.value.push(...newTasks)
  
  ElMessage.success(`已添加 ${newTasks.length} 个识别任务，开始批量处理`)
  console.log('📝 批量任务信息:', batchTaskInfos.value)
  
  // 清空选择和任务信息
  selectedLibraryImageIds.value = []
  selectedLibraryShpIds.value = []
  batchTaskInfos.value = []
  
  // 开始处理批量任务
  processBatchTasks()
}

// 处理批量任务（按顺序依次处理）
let isProcessing = false
const processBatchTasks = async () => {
  if (isProcessing) return
  
  isProcessing = true
  
  const waitingTasks = batchTasks.value.filter(task => task.status === 'waiting')
  
  for (const task of waitingTasks) {
    await processTask(task)
  }
  
  isProcessing = false
  
  // 全部完成后显示通知
  if (allTasksCompleted.value) {
    ElNotification({
      title: '✅ 批量识别完成',
      message: `已完成 ${batchTasks.value.length} 个影像的识别，结果已保存`,
      type: 'success',
      duration: 8000
    })
    
    // 刷新识别结果列表
    await loadRecognitionFiles()
  }
}

// 处理单个任务
const processTask = (task) => {
  return new Promise((resolve) => {
    task.status = 'processing'
    task.progress = 0
    task.startTime = Date.now()
    
    // 更新经过时间的定时器
    const timeInterval = setInterval(() => {
      if (task.status === 'processing') {
        const elapsed = Math.floor((Date.now() - task.startTime) / 1000)
        const minutes = Math.floor(elapsed / 60)
        const seconds = elapsed % 60
        task.elapsedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      } else {
        clearInterval(timeInterval)
      }
    }, 1000)
    
    // 模拟分类识别过程
    // 步骤1: 上传/加载 (0-20%)
    task.statusText = '正在加载影像数据...'
    setTimeout(() => {
      task.progress = 20
      task.statusText = '影像加载完成，正在预处理...'
    }, 800)
    
    // 步骤2: 预处理 (20-40%)
    setTimeout(() => {
      task.progress = 40
      task.statusText = '预处理完成，正在进行智能识别...'
    }, 1800)
    
    // 步骤3: 识别 (40-85%)
    setTimeout(() => {
      task.progress = 70
      task.statusText = '智能识别中...'
    }, 3000)
    
    setTimeout(() => {
      task.progress = 85
      task.statusText = '正在保存识别结果...'
    }, 4200)
    
    // 步骤4: 完成 (85-100%)
    setTimeout(() => {
      task.progress = 100
      task.status = 'completed'
      task.statusText = '识别完成'
      clearInterval(timeInterval)
      
      console.log(`✅ 任务完成: ${task.name}`)
      resolve()
    }, 5000)
  })
}

// 清空批量任务列表
const handleClearBatchTasks = () => {
  batchTasks.value = []
  ElMessage.success('已清空任务列表')
}

// 功能B.1：执行种植差异检测（真实数据分析）
const handleRunDifferenceDetection = async () => {
  if (!differenceConfig.value.baseFileId || !differenceConfig.value.compareFileId) {
    ElMessage.warning('请选择两个识别结果文件进行对比')
    return
  }

  differenceLoading.value = true
  showDifferenceDialog.value = false
  
  // 显示任务执行状态
  analysisTaskRunning.value = true
  analysisProgress.value = 0
  analysisStatusText.value = '正在加载识别结果文件...'

  try {
    // 获取选择的文件
    const baseFile = recognitionFiles.value.find(f => f.id === differenceConfig.value.baseFileId)
    const compareFile = recognitionFiles.value.find(f => f.id === differenceConfig.value.compareFileId)

    if (!baseFile || !compareFile) {
      throw new Error('未找到选择的文件，请重新选择')
    }

    console.log('开始差异检测分析')
    console.log('原始图文件:', baseFile)
    console.log('对比图文件:', compareFile)

    // 1. 读取两个文件（支持SHP和GeoJSON）
    analysisProgress.value = 20
    analysisStatusText.value = '正在读取原始图数据...'
    console.log(`正在读取原始图: ${baseFile.name}, 类型: ${baseFile.type}`)
    
    // 🔧 辅助函数：读取文件并转换为GeoJSON格式
    const readFileAsGeojson = async (file) => {
      if (file.type === 'SHP') {
        // SHP文件：先尝试转换为GeoJSON，如果已存在则直接读取
        console.log(`  SHP文件，需要转换: ${file.name}, 相对路径: ${file.relativePath || '根目录'}`)
        const { convertShpToGeojson } = await import('@/api/analysis')
        
        try {
          // 🔧 修复：传递relativePath参数，支持子文件夹
          const convertResponse = await convertShpToGeojson(file.name, file.relativePath)
          
          if (convertResponse.code === 200) {
            // 转换成功，返回数据
            console.log(`  ✅ SHP转换成功`)
            return convertResponse.data
          } else if (convertResponse.code === 400 && convertResponse.message?.includes('已经转换过了')) {
            // 文件已存在，直接读取对应的GeoJSON文件
            console.log(`  ℹ️ SHP已转换过，直接读取GeoJSON文件`)
            const geojsonFilename = file.name.replace(/\.shp$/i, '.geojson')
            const geojsonResponse = await readGeojsonContent(geojsonFilename)
            
            if (geojsonResponse.code === 200) {
              console.log(`  ✅ 读取已转换的GeoJSON成功`)
              return geojsonResponse.data
            } else {
              throw new Error(`读取已转换的GeoJSON失败: ${geojsonResponse.message}`)
            }
          } else {
            throw new Error(`SHP转换失败: ${convertResponse.message}`)
          }
        } catch (error) {
          // 如果转换失败，尝试直接读取GeoJSON（可能已经转换过）
          console.log(`  ⚠️ 转换出错，尝试读取已存在的GeoJSON`)
          const geojsonFilename = file.name.replace(/\.shp$/i, '.geojson')
          try {
            const geojsonResponse = await readGeojsonContent(geojsonFilename)
            if (geojsonResponse.code === 200) {
              console.log(`  ✅ 读取已存在的GeoJSON成功`)
              return geojsonResponse.data
            }
          } catch (e) {
            console.error(`  ❌ 读取GeoJSON也失败:`, e)
          }
          throw error
        }
      } else {
        // GeoJSON文件：直接读取
        console.log(`  GeoJSON文件，直接读取: ${file.name}`)
        const response = await readGeojsonContent(file.name)
        if (response.code === 200) {
          return response.data
        } else {
          throw new Error(`读取GeoJSON失败: ${response.message}`)
        }
      }
    }
    
    const baseGeojson = await readFileAsGeojson(baseFile)
    console.log('原始图读取成功，要素数:', baseGeojson.features?.length || 0)
    
    analysisProgress.value = 35
    analysisStatusText.value = '正在读取对比图数据...'
    const compareGeojson = await readFileAsGeojson(compareFile)
    console.log('对比图读取成功，要素数:', compareGeojson.features?.length || 0)
    
    console.log(`原始图包含 ${baseGeojson.features?.length || 0} 个要素`)
    console.log(`对比图包含 ${compareGeojson.features?.length || 0} 个要素`)
    
    // 2. 进行差异分析
    analysisProgress.value = 50
    analysisStatusText.value = '正在进行空间叠加分析...'
    
    const diffResult = performDifferenceAnalysis(baseGeojson, compareGeojson, baseFile, compareFile)
    
    analysisProgress.value = 75
    analysisStatusText.value = '正在生成分析报告...'
    
    // 3. 保存分析结果到全局状态（用于ResultCompare直接展示）
    const analysisResult = {
      type: 'difference',
      title: `${baseFile.taskName} vs ${compareFile.taskName}`,
      baseFile: {
        id: baseFile.id,
        name: baseFile.name,
        taskName: baseFile.taskName,
        geojson: baseGeojson
      },
      compareFile: {
        id: compareFile.id,
        name: compareFile.name,
        taskName: compareFile.taskName,
        geojson: compareGeojson
      },
      features: diffResult.geojson.features,
      stats: diffResult.stats,
      metadata: diffResult.geojson.metadata,
      analysisTime: new Date().toLocaleString('zh-CN')
    }
    
    analysisProgress.value = 90
    analysisStatusText.value = '正在准备可视化...'
    
    console.log('差异检测完成，结果:', analysisResult)
    console.log(`共 ${diffResult.stats.total} 个地块，${diffResult.stats.changed} 个有变化`)
    
    // 保存到全局状态
    analysisStore.setDifferenceResult(analysisResult)

    analysisProgress.value = 95
    analysisStatusText.value = '正在保存分析结果...'
    
    // 保存完整的JSON格式分析结果到服务器
    try {
      const analysisName = differenceConfig.value.analysisName || `${baseFile.taskName} vs ${compareFile.taskName}`
      const analysisData = {
        version: '1.0',
        id: `difference_${Date.now()}`,
        type: 'difference',
        metadata: {
          title: analysisName,
          createTime: new Date().toLocaleString('zh-CN'),
          baseFile: baseFile.taskName,
          compareFile: compareFile.taskName,
          totalPlots: diffResult.stats.total,
          changedPlots: diffResult.stats.changed,
          notes: differenceConfig.value.notes || ''
        },
        data: analysisResult
      }
      
      console.log('📝 差异检测分析信息:', {
        name: analysisName,
        notes: differenceConfig.value.notes
      })
      
      const saveResponse = await saveAnalysisResultToServer('difference', analysisData)
      console.log('✅ 差异分析结果已保存为JSON:', saveResponse.data)
    } catch (error) {
      console.error('保存JSON失败:', error)
      ElMessage.warning('分析结果保存失败，但可以继续查看')
    }
    
    analysisProgress.value = 100
    analysisStatusText.value = '分析完成！'
    
    differenceLoading.value = false
    
    // 显示成功提示
    ElNotification({
      title: '✅ 差异检测完成',
      message: `已检测到${diffResult.stats.changed}个变化地块，分析结果已保存`,
      type: 'success',
      duration: 5000
    })
    
    // 等待2秒后关闭进度对话框并跳转
    setTimeout(() => {
      analysisTaskRunning.value = false
      router.push('/result-compare')
    }, 2000)
    
  } catch (error) {
    console.error('差异检测失败:', error)
    console.error('错误详情:', error.response?.data || error.response || error)
    analysisTaskRunning.value = false
    differenceLoading.value = false
    
    let errorMsg = '差异检测失败'
    if (error.response?.data?.message) {
      errorMsg += ': ' + error.response.data.message
    } else if (error.message) {
      errorMsg += ': ' + error.message
    }
    
    ElMessage({
      message: errorMsg,
      type: 'error',
      duration: 8000,
      showClose: true
    })
  }
}

// 执行差异分析（对比两个GeoJSON）
// 坐标转换：从Web Mercator (EPSG:3857) 转为 WGS84 (EPSG:4326)
const mercatorToLatLng = (x, y) => {
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    const lng = (x / 20037508.34) * 180
    let lat = (y / 20037508.34) * 180
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2)
    return [lng, lat]
  }
  return [x, y]
}

// 计算多边形面积（使用球面几何，返回平方米）
const calculatePolygonArea = (coordinates) => {
  if (!coordinates || !coordinates[0] || coordinates[0].length < 3) {
    return 0
  }
  
  const EARTH_RADIUS = 6378137
  const ring = coordinates[0].map(([x, y]) => {
    const [lng, lat] = mercatorToLatLng(x, y)
    return [lng, lat]
  })
  
  let area = 0
  const n = ring.length - 1
  
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = ring[i]
    const [lng2, lat2] = ring[i + 1]
    const lat1Rad = lat1 * Math.PI / 180
    const lat2Rad = lat2 * Math.PI / 180
    const lngDiff = (lng2 - lng1) * Math.PI / 180
    area += lngDiff * (2 + Math.sin(lat1Rad) + Math.sin(lat2Rad))
  }
  
  area = Math.abs(area * EARTH_RADIUS * EARTH_RADIUS / 2)
  return area
}

// 计算地块面积并转换为亩（1亩 ≈ 666.67平方米）
const calculateFeatureAreaInMu = (feature) => {
  if (!feature || !feature.geometry) {
    return 0
  }
  
  try {
    let areaInSquareMeters = 0
    
    if (feature.geometry.type === 'Polygon') {
      areaInSquareMeters = calculatePolygonArea(feature.geometry.coordinates)
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach(polygon => {
        areaInSquareMeters += calculatePolygonArea(polygon)
      })
    }
    
    const areaInMu = areaInSquareMeters / 666.67
    return Math.round(areaInMu * 100) / 100
  } catch (error) {
    console.error('计算面积失败:', error)
    return 0
  }
}

const performDifferenceAnalysis = (baseGeojson, compareGeojson, baseFile, compareFile) => {
  const baseFeatures = baseGeojson.features || []
  const compareFeatures = compareGeojson.features || []
  
  console.log('=== 差异分析开始 ===')
  console.log(`原始图要素数: ${baseFeatures.length}`)
  console.log(`对比图要素数: ${compareFeatures.length}`)
  
  // 打印第一个要素的属性，帮助调试
  if (baseFeatures.length > 0) {
    console.log('原始图第一个要素属性:', baseFeatures[0].properties)
  }
  if (compareFeatures.length > 0) {
    console.log('对比图第一个要素属性:', compareFeatures[0].properties)
  }
  
  // 构建对比图的快速查找索引（按plotId或FID）
  const compareMap = new Map()
  compareFeatures.forEach((feature, idx) => {
    const props = feature.properties || {}
    const id = props.FID || props.id || props.plotId || props.OBJECTID || idx
    compareMap.set(String(id), feature)
  })
  
  console.log(`对比图索引构建完成，共 ${compareMap.size} 个地块`)
  
  const resultFeatures = []
  let changedCount = 0
  let unchangedCount = 0
  let matchedCount = 0
  
  // 对比每个地块
  baseFeatures.forEach((baseFeature, index) => {
    const baseProps = baseFeature.properties || {}
    const id = baseProps.FID || baseProps.id || baseProps.plotId || baseProps.OBJECTID || index
    
    // 优先使用gridcode字段判断作物类型！
    const baseGridcode = baseProps.gridcode || baseProps.GRIDCODE || baseProps.GridCode
    const baseCrop = baseGridcode !== undefined 
      ? `作物${baseGridcode}` 
      : (baseProps.label || baseProps.crop || baseProps.class || baseProps.type || baseProps.作物类型 || baseProps.cropType || '未知')
    
    // 在对比图中查找对应地块
    const compareFeature = compareMap.get(String(id))
    
    let currentCrop = '未种植'
    let currentGridcode = null
    let diffType = 'unchanged'
    let hasChange = false
    
    if (compareFeature) {
      matchedCount++
      const compareProps = compareFeature.properties || {}
      
      // 优先使用gridcode字段判断作物类型！
      currentGridcode = compareProps.gridcode || compareProps.GRIDCODE || compareProps.GridCode
      currentCrop = currentGridcode !== undefined 
        ? `作物${currentGridcode}` 
        : (compareProps.label || compareProps.crop || compareProps.class || compareProps.type || compareProps.作物类型 || compareProps.cropType || '未知')
      
      // 判断是否变化（比较gridcode或作物类型）
      if (baseGridcode !== undefined && currentGridcode !== undefined) {
        // 如果有gridcode，直接比较gridcode
        if (baseGridcode !== currentGridcode) {
          diffType = 'changed'
          hasChange = true
          changedCount++
          
          // 打印前5个变化的地块，帮助调试
          if (changedCount <= 5) {
            console.log(`变化地块 ${changedCount}:`, {
              id: id,
              原始gridcode: baseGridcode,
              当前gridcode: currentGridcode,
              原始: baseCrop,
              当前: currentCrop
            })
          }
        } else {
          unchangedCount++
        }
      } else if (baseCrop !== currentCrop) {
        // 没有gridcode，比较作物名称
        diffType = 'changed'
        hasChange = true
        changedCount++
        
        if (changedCount <= 5) {
          console.log(`变化地块 ${changedCount}:`, {
            id: id,
            原始: baseCrop,
            当前: currentCrop
          })
        }
      } else {
        unchangedCount++
      }
    } else {
      // 在对比图中找不到，可能是撂荒或删除
      diffType = 'abandoned'
      hasChange = true
      changedCount++
    }
    
    // 计算地块面积（优先使用已有的area字段，如果没有则计算）
    let calculatedArea = baseProps.area || baseProps.Area || baseProps.面积
    if (!calculatedArea || calculatedArea === 0) {
      calculatedArea = calculateFeatureAreaInMu(baseFeature)
    }
    
    // 创建结果要素
    resultFeatures.push({
      type: 'Feature',
      properties: {
        ...baseProps,
        plotId: String(id),
        plotName: baseProps.name || baseProps.plotName || `地块${id}`,
        originalCrop: baseCrop,
        currentCrop: currentCrop,
        originalGridcode: baseGridcode, // 保存原始gridcode
        currentGridcode: currentGridcode, // 保存当前gridcode
        diffType: diffType,
        hasChange: hasChange,
        area: calculatedArea // 使用计算或已有的面积
      },
      geometry: baseFeature.geometry
    })
  })
  
  console.log('=== 差异分析完成 ===')
  console.log(`总地块数: ${resultFeatures.length}`)
  console.log(`匹配成功: ${matchedCount}`)
  console.log(`有变化: ${changedCount}`)
  console.log(`无变化: ${unchangedCount}`)
  
  // 构建结果GeoJSON
  const resultGeojson = {
    type: 'FeatureCollection',
    metadata: {
      analysisType: 'difference',
      baseFile: baseFile.name,
      compareFile: compareFile.name,
      baseTaskName: baseFile.taskName,
      compareTaskName: compareFile.taskName,
      analysisTime: new Date().toLocaleString('zh-CN'),
      totalFeatures: resultFeatures.length,
      changed: changedCount,
      unchanged: unchangedCount,
      matched: matchedCount
    },
    features: resultFeatures
  }
  
  return {
    geojson: resultGeojson,
    stats: {
      total: resultFeatures.length,
      changed: changedCount,
      unchanged: unchangedCount,
      matched: matchedCount
    }
  }
}

// 功能B.2：执行时序变化分析（真实数据分析）
const handleRunTemporalAnalysis = async () => {
  if (!temporalConfig.value.selectedFileIds || temporalConfig.value.selectedFileIds.length < 2) {
    ElMessage.warning('请至少选择2个识别结果文件进行时序分析')
    return
  }

  temporalLoading.value = true
  showTemporalDialog.value = false
  
  // 显示任务执行状态
  analysisTaskRunning.value = true
  analysisProgress.value = 0
  analysisStatusText.value = '正在加载多期识别结果...'

  try {
    // 获取选择的文件并按时间排序
    const selectedFiles = temporalConfig.value.selectedFileIds
      .map(id => recognitionFiles.value.find(f => f.id === id))
      .filter(f => f)
      .sort((a, b) => new Date(a.createTime) - new Date(b.createTime))

    console.log(`开始时序变化分析: ${selectedFiles.length}个时间点`)
    console.log('选择的文件:', selectedFiles)

    // 1. 读取所有文件（支持SHP和GeoJSON）
    const geojsonDataList = []
    
    // 🔧 辅助函数：读取文件并转换为GeoJSON格式
    const readFileAsGeojson = async (file) => {
      if (file.type === 'SHP') {
        // SHP文件：先尝试转换为GeoJSON，如果已存在则直接读取
        console.log(`  SHP文件，需要转换: ${file.name}, 相对路径: ${file.relativePath || '根目录'}`)
        const { convertShpToGeojson } = await import('@/api/analysis')
        
        try {
          // 🔧 修复：传递relativePath参数，支持子文件夹
          const convertResponse = await convertShpToGeojson(file.name, file.relativePath)
          
          if (convertResponse.code === 200) {
            // 转换成功，返回数据
            console.log(`  ✅ SHP转换成功`)
            return convertResponse.data
          } else if (convertResponse.code === 400 && convertResponse.message?.includes('已经转换过了')) {
            // 文件已存在，直接读取对应的GeoJSON文件
            console.log(`  ℹ️ SHP已转换过，直接读取GeoJSON文件`)
            const geojsonFilename = file.name.replace(/\.shp$/i, '.geojson')
            const geojsonResponse = await readGeojsonContent(geojsonFilename)
            
            if (geojsonResponse.code === 200) {
              console.log(`  ✅ 读取已转换的GeoJSON成功`)
              return geojsonResponse.data
            } else {
              throw new Error(`读取已转换的GeoJSON失败: ${geojsonResponse.message}`)
            }
          } else {
            throw new Error(`SHP转换失败: ${convertResponse.message}`)
          }
        } catch (error) {
          // 如果转换失败，尝试直接读取GeoJSON（可能已经转换过）
          console.log(`  ⚠️ 转换出错，尝试读取已存在的GeoJSON`)
          const geojsonFilename = file.name.replace(/\.shp$/i, '.geojson')
          try {
            const geojsonResponse = await readGeojsonContent(geojsonFilename)
            if (geojsonResponse.code === 200) {
              console.log(`  ✅ 读取已存在的GeoJSON成功`)
              return geojsonResponse.data
            }
          } catch (e) {
            console.error(`  ❌ 读取GeoJSON也失败:`, e)
          }
          throw error
        }
      } else {
        // GeoJSON文件：直接读取
        console.log(`  GeoJSON文件，直接读取: ${file.name}`)
        const response = await readGeojsonContent(file.name)
        if (response.code === 200) {
          return response.data
        } else {
          throw new Error(`读取GeoJSON失败: ${response.message}`)
        }
      }
    }
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      analysisProgress.value = 10 + (i / selectedFiles.length) * 30
      analysisStatusText.value = `正在读取第${i + 1}/${selectedFiles.length}个文件...`
      
      console.log(`读取文件 ${i + 1}/${selectedFiles.length}: ${file.name}, 类型: ${file.type}`)
      try {
        const geojsonData = await readFileAsGeojson(file)
        geojsonDataList.push({
          file: file,
          geojson: geojsonData,
          time: file.createTime
        })
        console.log(`读取 ${file.name}: ${geojsonData.features?.length || 0} 个要素`)
      } catch (error) {
        console.error(`读取文件失败: ${file.name}`, error)
        throw error
      }
    }

    // 2. 进行时序分析
    analysisProgress.value = 50
    analysisStatusText.value = '正在分析时序变化轨迹...'
    
    const temporalResult = performTemporalAnalysis(geojsonDataList)
    
    analysisProgress.value = 75
    analysisStatusText.value = '正在生成分析报告...'
    
    // 3. 保存分析结果到全局状态（用于ResultCompare直接展示）
    const analysisResult = {
      type: 'temporal',
      title: `${selectedFiles.length}期时序对比`,
      files: selectedFiles.map(f => ({
        id: f.id,
        name: f.name,
        taskName: f.taskName,
        createTime: f.createTime
      })),
      timePoints: geojsonDataList.map(d => ({
        time: d.time,
        taskName: d.file.taskName,
        createTime: d.file.createTime,
        geojson: d.geojson
      })),
      features: temporalResult.geojson.features,
      stats: temporalResult.stats,
      filesCount: selectedFiles.length,
      // 将metadata中的数据提取到根级别，方便访问
      transitionMatrix: temporalResult.geojson.metadata.transitionMatrix || [],
      cropDistribution: temporalResult.geojson.metadata.cropDistribution || [],
      trajectories: temporalResult.analysisResult?.trajectories || [],
      qualityReport: temporalResult.analysisResult?.qualityReport || { warnings: [], timePointCounts: [], matchRate: 100 },
      metadata: temporalResult.geojson.metadata,
      analysisTime: new Date().toLocaleString('zh-CN')
    }
    
    analysisProgress.value = 90
    analysisStatusText.value = '正在准备可视化...'
    
    console.log('时序分析完成，结果:', analysisResult)
    console.log(`共 ${temporalResult.stats.total} 个地块，${temporalResult.stats.changed} 个有变化`)
    
    // 保存到全局状态
    analysisStore.setTemporalResult(analysisResult)

    analysisProgress.value = 95
    analysisStatusText.value = '正在保存分析结果...'
    
    // 保存完整的JSON格式分析结果到服务器
    try {
      const analysisName = temporalConfig.value.analysisName || `${selectedFiles.length}期时序对比`
      const analysisData = {
        version: '1.0',
        id: `temporal_${Date.now()}`,
        type: 'temporal',
        metadata: {
          title: analysisName,
          createTime: new Date().toLocaleString('zh-CN'),
          filesCount: selectedFiles.length,
          timeRange: `${selectedFiles[0].taskName} ~ ${selectedFiles[selectedFiles.length-1].taskName}`,
          totalPlots: temporalResult.stats.total,
          changedPlots: temporalResult.stats.changed,
          notes: temporalConfig.value.notes || ''
        },
        data: analysisResult
      }
      
      console.log('📝 时序分析信息:', {
        name: analysisName,
        notes: temporalConfig.value.notes
      })
      
      const saveResponse = await saveAnalysisResultToServer('temporal', analysisData)
      console.log('✅ 时序分析结果已保存为JSON:', saveResponse.data)
    } catch (error) {
      console.error('保存JSON失败:', error)
      ElMessage.warning('分析结果保存失败，但可以继续查看')
    }
    
    analysisProgress.value = 100
    analysisStatusText.value = '分析完成！'
    
    temporalLoading.value = false
    
    // 显示成功提示
    ElNotification({
      title: '✅ 时序分析完成',
      message: `已完成${selectedFiles.length}期时序变化分析（共${temporalResult.stats.total}个地块，${temporalResult.stats.changed}个有变化）`,
      type: 'success',
      duration: 5000
    })
    
    // 等待2秒后关闭进度对话框并跳转
    setTimeout(() => {
      analysisTaskRunning.value = false
      router.push('/result-compare')
    }, 2000)
    
  } catch (error) {
    console.error('时序分析失败:', error)
    console.error('错误详情:', error.response?.data || error.response || error)
    analysisTaskRunning.value = false
    temporalLoading.value = false
    
    let errorMsg = '时序分析失败'
    if (error.response?.data?.message) {
      errorMsg += ': ' + error.response.data.message
    } else if (error.message) {
      errorMsg += ': ' + error.message
    }
    
    ElMessage({
      message: errorMsg,
      type: 'error',
      duration: 8000,
      showClose: true
    })
  }
}

// 执行时序分析（追踪多个时间点的变化）
const performTemporalAnalysis = (geojsonDataList) => {
  if (!geojsonDataList || geojsonDataList.length < 2) {
    throw new Error('时序分析至少需要2个时间点的数据')
  }
  
  console.log('🔬 使用增强版时序分析算法')
  
  // 准备数据格式
  const timePointsData = geojsonDataList.map(item => ({
    time: item.time,
    taskName: item.file.taskName,
    createTime: item.file.createTime,
    geojsonData: item.geojson
  }))
  
  // 使用新的核心算法进行分析
  const analysisResult = buildTemporalTrajectories(timePointsData, {
    idField: 'Id', // 根据你的GeoJSON数据的实际字段调整
    cropField: 'gridcode', // 作物代码字段
    areaField: 'area' // 面积字段
  })
  
  console.log('✅ 时序分析完成，统计信息:', analysisResult.stats)
  console.log('📊 作物转换矩阵:', analysisResult.transitionMatrix)
  console.log('📊 作物分布:', analysisResult.cropDistribution)
  
  // 兼容原有的返回格式
  return {
    geojson: {
      type: 'FeatureCollection',
      metadata: {
        analysisType: 'temporal',
        timePoints: analysisResult.timePoints,
        filesCount: analysisResult.filesCount,
        analysisTime: new Date().toLocaleString('zh-CN'),
        totalFeatures: analysisResult.stats.total,
        changed: analysisResult.stats.changed,
        unchanged: analysisResult.stats.unchanged,
        transitionMatrix: analysisResult.transitionMatrix,
        cropDistribution: analysisResult.cropDistribution
      },
      features: analysisResult.features
    },
    stats: analysisResult.stats,
    analysisResult: analysisResult // 保留完整的分析结果供后续使用
  }
}

// 一键清空所有分析数据 - 已移除此功能
// const handleClearAllData = () => {
//   ...
// }
</script>

<style scoped lang="scss">
.task-management-container {
  // 页面标题
  .page-header {
    margin-bottom: 20px;
    padding: 20px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    color: white;
    
    .page-title {
      margin: 0 0 6px 0;
      font-size: 26px;
      font-weight: 700;
    }
    
    .page-description {
      margin: 0;
      font-size: 15px;
      opacity: 0.95;
    }
  }
  
  // 使用教程区域
  .guide-section {
    margin-bottom: 20px;
    border: none;
    
    :deep(.el-collapse-item__header) {
      background: #f5f7fa;
      border-radius: 8px;
      padding: 12px 16px;
      border: 1px solid #e4e7ed;
      
      &:hover {
        background: #e9ecef;
      }
    }
    
    :deep(.el-collapse-item__content) {
      padding: 0;
    }
    
    .guide-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: #409EFF;
    }
    
    .guide-content {
      padding: 20px;
      background: #fafbfc;
      
      .guide-step {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        .step-number {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 16px;
        }
        
        .step-content {
          flex: 1;
          
          h4 {
            margin: 0 0 6px 0;
            font-size: 16px;
            color: #303133;
          }
          
          p {
            margin: 0;
            font-size: 14px;
            color: #606266;
            line-height: 1.6;
            
            strong {
              color: #409EFF;
            }
          }
        }
      }
      
      .guide-tips {
        margin-top: 16px;
        padding: 12px 16px;
        background: #fff7e6;
        border-left: 4px solid #E6A23C;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #606266;
        
        strong {
          color: #E6A23C;
        }
      }
    }
  }
  
  // 模块卡片通用样式
  .module-card {
    margin-bottom: 24px;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s;
    
    &:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }
    
    .module-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .module-title {
        font-size: 18px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }
  
  // 作物识别模块
  .classification-module {
    border: 2px solid #667eea;
    
    .classification-with-progress {
      display: flex;
      gap: 20px;
      
      // 左侧：识别操作区
      .classification-main {
        flex: 1;
        padding: 24px;
        
        // 数据来源选择器
        .image-source-selector {
          margin-bottom: 24px;
          display: flex;
          justify-content: center;
          
          :deep(.el-radio-button__inner) {
            padding: 12px 32px;
            font-size: 15px;
            
            .el-icon {
              margin-right: 6px;
            }
          }
        }
        
        // 双上传容器
        .dual-upload-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
          
          .upload-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            
            .upload-area {
              padding: 32px 20px;
              background: linear-gradient(135deg, #f5f7fa 0%, #e3e7f1 100%);
              border: 2px dashed #409EFF;
              border-radius: 12px;
              text-align: center;
              cursor: pointer;
              transition: all 0.3s;
              
              &:hover {
                border-color: #667eea;
                background: linear-gradient(135deg, #e3e7f1 0%, #d4daf0 100%);
                transform: scale(1.02);
              }
              
              .upload-icon {
                margin-bottom: 12px;
                animation: float 3s ease-in-out infinite;
              }
              
              .upload-text {
                margin-bottom: 16px;
                
                h3 {
                  margin: 0 0 6px 0;
                  font-size: 17px;
                  color: #303133;
                  font-weight: 600;
                }
                
                p {
                  margin: 0;
                  font-size: 13px;
                  color: #606266;
                }
              }
              
              .upload-btn {
                font-size: 14px;
              }
            }
            
            // 文件列表
            .file-list {
              padding: 12px;
              background: #f9fafb;
              border: 1px solid #e4e7ed;
              border-radius: 8px;
              max-height: 200px;
              overflow-y: auto;
              
              .list-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid #e4e7ed;
                font-size: 13px;
                font-weight: 600;
                color: #606266;
              }
              
              .file-items {
                display: flex;
                flex-direction: column;
                gap: 6px;
                
                .file-item {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  padding: 6px 10px;
                  background: white;
                  border: 1px solid #e4e7ed;
                  border-radius: 6px;
                  font-size: 12px;
                  transition: all 0.2s;
                  
                  &:hover {
                    border-color: #409EFF;
                    background: #ecf5ff;
                  }
                  
                  .file-name {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #303133;
                  }
                }
              }
            }
          }
        }
        
        // 配对状态提示
        .pairing-status {
          padding: 16px;
          border-radius: 8px;
          
          .status-empty {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #909399;
            font-size: 14px;
          }
          
          .status-warning {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px;
            background: #fff7e6;
            border-left: 4px solid #E6A23C;
            border-radius: 4px;
            color: #606266;
            font-size: 14px;
          }
          
          .status-success {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px;
            background: #f0f9ff;
            border-left: 4px solid #67C23A;
            border-radius: 4px;
            color: #606266;
            font-size: 14px;
            font-weight: 500;
          }
        }
        
        // 影像管理模式
        .library-mode {
          padding: 20px;
          background: #f9fafb;
          border-radius: 12px;
          
          .library-dual-select {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
            
            .library-select-section {
              .select-label {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 10px;
                font-size: 14px;
                font-weight: 600;
                color: #303133;
              }
              
              .library-selector {
                width: 100%;
                
                :deep(.el-input__wrapper) {
                  min-height: 44px;
                }
              }
              
              .select-count {
                margin-top: 8px;
                font-size: 12px;
                color: #909399;
                text-align: right;
              }
              
              .image-option {
                display: flex;
                flex-direction: column;
                gap: 4px;
                
                .image-name {
                  font-size: 14px;
                  color: #303133;
                  font-weight: 500;
                }
                
                .image-info {
                  font-size: 12px;
                  color: #909399;
                }
              }
            }
          }
          
          .library-pairing-status {
            padding: 16px;
            border-radius: 8px;
            
            .status-empty {
              display: flex;
              align-items: center;
              gap: 8px;
              color: #909399;
              font-size: 14px;
            }
            
            .status-warning {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 12px;
              background: #fff7e6;
              border-left: 4px solid #E6A23C;
              border-radius: 4px;
              color: #606266;
              font-size: 14px;
            }
            
            .status-success {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 12px;
              background: #f0f9ff;
              border-left: 4px solid #67C23A;
              border-radius: 4px;
              color: #606266;
              font-size: 14px;
              font-weight: 500;
            }
          }

          // 任务信息表单
          .task-info-form {
            margin-top: 24px;
            padding: 20px;
            background: linear-gradient(135deg, #f5f7fa 0%, #e8edf5 100%);
            border-radius: 12px;
            border: 2px solid #409EFF;

            .form-title {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 15px;
              font-weight: 600;
              color: #303133;
              margin-bottom: 16px;
              padding-bottom: 12px;
              border-bottom: 2px solid #e4e7ed;
            }
          }
        }
      }
      
      // 右侧：批量识别进度面板
      .progress-sidebar {
        width: 320px;
        flex-shrink: 0;
        background: #fafbfc;
        border-left: 2px solid #e4e7ed;
        display: flex;
        flex-direction: column;
        
        .progress-header {
          padding: 16px;
          border-bottom: 1px solid #e4e7ed;
          
          .progress-title {
            font-size: 15px;
            font-weight: 600;
            color: #303133;
            display: flex;
            align-items: center;
            gap: 6px;
          }
        }
        
        .progress-content {
          padding: 12px;
          flex: 1;
          overflow-y: auto;
          max-height: 500px;
          
          .task-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            
            .task-item {
              padding: 12px;
              background: white;
              border: 1px solid #e4e7ed;
              border-radius: 8px;
              transition: all 0.3s;
              
              &.task-processing {
                border-color: #409EFF;
                background: #ecf5ff;
                box-shadow: 0 2px 8px rgba(64, 158, 255, 0.1);
              }
              
              &.task-completed {
                border-color: #67C23A;
                background: #f0f9ff;
              }
              
              .task-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 10px;
                gap: 8px;
                
                .task-name {
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  font-size: 13px;
                  font-weight: 600;
                  color: #303133;
                  flex: 1;
                  min-width: 0;
                  
                  span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  }
                }
              }
              
              // 文件配对信息
              .task-files {
                margin-bottom: 10px;
                padding: 8px;
                background: #f9fafb;
                border-radius: 6px;
                
                .file-pair {
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  font-size: 11px;
                  color: #606266;
                  margin-bottom: 4px;
                  
                  &:last-child {
                    margin-bottom: 0;
                  }
                  
                  .file-pair-name {
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  }
                }
              }
              
              .task-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 6px;
                font-size: 11px;
                
                .task-progress-text {
                  color: #606266;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  flex: 1;
                }
                
                .task-time {
                  color: #909399;
                  font-family: 'Courier New', monospace;
                  margin-left: 8px;
                  flex-shrink: 0;
                }
              }
            }
          }
          
          .batch-summary {
            margin-top: 12px;
            
            .compact-alert {
              padding: 8px 12px;
              
              :deep(.el-alert__title) {
                font-size: 13px;
              }
            }
          }
        }
      }
    }
  }
  
  // 变化检测与差异分析模块
  .analysis-module {
    border: 2px solid #67C23A;
    
  .analysis-actions {
    display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    padding: 20px 0;
    
      .action-card {
      cursor: pointer;
      transition: all 0.3s;
      border: 2px solid #ebeef5;
        border-radius: 8px;
      
      &:hover {
          border-color: #67C23A;
          box-shadow: 0 6px 16px rgba(103, 194, 58, 0.2);
        transform: translateY(-4px);
      }
      
      .action-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px;
        
        .action-icon {
          font-size: 48px;
          opacity: 0.9;
        }
        
        .action-text {
          flex: 1;
          
          .action-title {
            font-size: 18px;
            font-weight: 600;
            color: #303133;
            margin-bottom: 8px;
          }
          
          .action-desc {
            font-size: 14px;
            color: #909399;
              line-height: 1.5;
            }
          }
          }
        }
      }
    }
  }
  
// 分析进度对话框
.analysis-progress-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  
  .progress-text {
    margin-top: 24px;
    font-size: 15px;
    color: #606266;
    font-weight: 500;
    text-align: center;
  }
  
  .el-button {
    margin-top: 24px;
  }
}

// 浮动动画
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

// 旋转动画
@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.rotating {
  animation: rotating 2s linear infinite;
}

// 响应式设计
@media (max-width: 768px) {
  .task-management-container {
    .page-header {
      padding: 16px;
      
      .page-title {
        font-size: 22px;
      }
      
      .page-description {
        font-size: 14px;
      }
    }
    
    .guide-section {
      .guide-content {
        padding: 16px;
        
        .guide-step {
          .step-number {
            width: 28px;
            height: 28px;
            font-size: 14px;
          }
          
          .step-content h4 {
            font-size: 15px;
          }
        }
      }
    }
    
    .classification-module .classification-with-progress {
      flex-direction: column;
      
      .classification-main {
        padding: 16px;
        
        .dual-upload-container {
          grid-template-columns: 1fr;
          
          .upload-section {
            .upload-area {
              padding: 24px 16px;
              
              .upload-text h3 {
                font-size: 16px;
              }
            }
          }
        }
        
        .library-mode {
          .library-dual-select {
            grid-template-columns: 1fr;
          }
        }
      }
      
      .progress-sidebar {
        width: 100%;
        border-left: none;
        border-top: 2px solid #e4e7ed;
        
        .progress-content {
          max-height: 300px;
        }
      }
    }
    
    .analysis-module .analysis-actions {
      grid-template-columns: 1fr;
    }
  }
}
</style>

