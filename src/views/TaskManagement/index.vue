<template>
  <div class="task-management-container">
    <!-- 操作栏 -->
    <el-card class="action-card" shadow="never">
      <el-space wrap>
        <el-button type="primary" @click="showTaskDialog = true">
          <template #icon><Plus :size="16" /></template>
          新建识别任务
        </el-button>
        <el-button @click="handleRefresh">
          <template #icon><RefreshCw :size="16" /></template>
          刷新列表
        </el-button>
        <el-divider direction="vertical" />
        <el-select v-model="statusFilter" placeholder="任务状态" style="width: 120px" clearable>
          <el-option label="全部" value="" />
          <el-option label="排队中" value="pending" />
          <el-option label="运行中" value="running" />
          <el-option label="已完成" value="completed" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索任务名称"
          style="width: 200px"
          :prefix-icon="Search"
          clearable
        />
      </el-space>
    </el-card>

    <!-- 任务统计 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card stat-all">
          <el-statistic :value="taskStats.total" title="总任务数">
            <template #prefix>
              <el-icon><Tickets /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card stat-running">
          <el-statistic :value="taskStats.running" title="运行中">
            <template #prefix>
              <el-icon><Loading /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card stat-completed">
          <el-statistic :value="taskStats.completed" title="已完成">
            <template #prefix>
              <el-icon><CircleCheck /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card stat-failed">
          <el-statistic :value="taskStats.failed" title="失败">
            <template #prefix>
              <el-icon><CircleClose /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 任务列表 -->
    <el-card shadow="never" class="task-list-card">
      <template #header>
        <span><el-icon><List /></el-icon> 任务队列</span>
      </template>
      
      <el-table :data="paginatedTaskList" style="width: 100%" max-height="500">
        <el-table-column prop="id" label="任务ID" width="100" />
        <el-table-column prop="name" label="任务名称" min-width="200" />
        <el-table-column prop="method" label="分析方法" width="120">
          <template #default="scope">
            <el-tag>{{ scope.row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="scope">
            <el-tag
              :type="getStatusType(scope.row.status)"
              :icon="getStatusIcon(scope.row.status)"
            >
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="200">
          <template #default="scope">
            <el-progress
              :percentage="scope.row.progress"
              :status="scope.row.status === 'failed' ? 'exception' : scope.row.status === 'completed' ? 'success' : ''"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="160" />
        <el-table-column prop="duration" label="耗时" width="100" />
        <el-table-column label="操作" width="450" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.status === 'completed'"
              size="small"
              :type="selectedTask?.id === scope.row.id ? 'success' : 'primary'"
              @click="handleSelectTask(scope.row)"
            >
              <template #icon><GitCompare :size="14" /></template>
              {{ selectedTask?.id === scope.row.id ? '已选择' : '选择' }}
            </el-button>
            <el-button
              v-if="scope.row.status === 'completed'"
              size="small"
              type="success"
              @click="handleViewResult(scope.row)"
            >
              <template #icon><Eye :size="14" /></template>
              查看结果
            </el-button>
            <el-button
              size="small"
              @click="handleViewLog(scope.row)"
            >
              <template #icon><File :size="14" /></template>
              日志
            </el-button>
            <el-button
              v-if="scope.row.status === 'pending' || scope.row.status === 'running'"
              size="small"
              type="warning"
              @click="handleStop(scope.row)"
            >
              <template #icon><Play :size="14" /></template>
              停止
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="handleDelete(scope.row)"
            >
              <template #icon><Trash2 :size="14" /></template>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalTasks"
        />
      </div>
    </el-card>

    <!-- 变化检测与差异分析模块 -->
    <el-card shadow="never" class="analysis-module-card">
      <template #header>
        <div class="module-header">
          <div class="module-left">
            <span class="module-title">
              <el-icon><DataAnalysis /></el-icon>
              变化检测与差异分析
            </span>
            <el-tag v-if="selectedTask" type="success">
              已选择任务：{{ selectedTask.name }}
            </el-tag>
            <el-tag v-else type="info">请先在上方任务列表中选择一个已完成的任务</el-tag>
          </div>
          <el-button 
            v-if="hasAnalysisData" 
            type="danger" 
            size="small" 
            @click="handleClearAllData"
          >
            <template #icon><Trash2 :size="14" /></template>
            一键清空
          </el-button>
        </div>
      </template>

      <!-- 未选择任务时的提示 -->
      <div v-if="!selectedTask" class="empty-state">
        <el-empty description="请在上方任务列表中点击【选择】按钮，选择一个已完成的分析任务">
          <el-button type="primary" @click="scrollToTaskList">
            <template #icon><RefreshCw :size="14" /></template>
            前往选择任务
          </el-button>
        </el-empty>
      </div>

      <!-- 已选择任务时显示功能tabs -->
      <el-tabs v-else v-model="activeAnalysisTab" class="analysis-tabs">
        <!-- Tab 1: 种植差异检测 -->
        <el-tab-pane label="种植差异检测" name="difference">
          <div class="analysis-content">
            <el-row :gutter="20">
              <el-col :span="16">
                <el-card shadow="hover">
                  <template #header>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>差异检测配置</span>
                      <el-button type="primary" @click="handleRunDifferenceDetection" :loading="differenceLoading">
                        <template #icon><Play :size="14" /></template>
                        {{ differenceLoading ? '检测中...' : '执行检测' }}
                      </el-button>
                    </div>
                  </template>

                  <el-form label-width="120px">
                    <el-form-item label="分析任务">
                      <el-input :value="selectedTask.name" disabled />
                    </el-form-item>
                    <el-form-item label="影像数据">
                      <el-input :value="selectedTask.imageId || 'Sentinel2_XJ_20240315_L2A'" disabled />
                    </el-form-item>
                    <el-form-item label="地块数据">
                      <el-select v-model="differenceConfig.plotData" style="width: 100%">
                        <el-option label="乌鲁木齐市地块数据（含规划作物）" value="plot001" />
                        <el-option label="喀什地区地块数据（含规划作物）" value="plot002" />
                        <el-option label="全疆地块数据汇总" value="plot_all" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="差异阈值">
                      <el-slider v-model="differenceConfig.threshold" :min="0" :max="100" :step="5" />
                      <span style="margin-left: 10px">{{ differenceConfig.threshold }}%</span>
                    </el-form-item>
                  </el-form>
                </el-card>

                <!-- 差异检测结果 -->
                <el-card v-if="differenceResultData.length" shadow="hover" style="margin-top: 20px;">
                  <template #header>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>差异检测结果</span>
                      <el-space>
                        <el-select v-model="differenceTypeFilter" placeholder="筛选差异类型" style="width: 160px" size="small" clearable>
                          <el-option label="全部" value="" />
                          <el-option label="类型不符" value="typeMismatch" />
                          <el-option label="撂荒/未种植" value="abandoned" />
                          <el-option label="非规划种植" value="unplanned" />
                        </el-select>
                        <el-button size="small" @click="handleExportDifference">
                          <template #icon><Download :size="14" /></template>
                          导出
                        </el-button>
                      </el-space>
                    </div>
                  </template>

                  <el-table :data="filteredDifferenceData" max-height="400" stripe>
                    <el-table-column prop="plotId" label="地块编号" width="100" />
                    <el-table-column prop="plotName" label="地块名称" width="140" />
                    <el-table-column prop="plannedCrop" label="规划作物" width="100">
                      <template #default="scope">
                        <el-tag type="info" size="small">{{ scope.row.plannedCrop }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="detectedCrop" label="识别作物" width="100">
                      <template #default="scope">
                        <el-tag size="small">{{ scope.row.detectedCrop }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="差异类型" width="120">
                      <template #default="scope">
                        <el-tag :type="getDiffTagType(scope.row.diffType)" size="small">
                          {{ getDiffTypeText(scope.row.diffType) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="area" label="面积(亩)" width="100" />
                    <el-table-column prop="confidence" label="置信度" width="90">
                      <template #default="scope">
                        {{ (scope.row.confidence * 100).toFixed(1) }}%
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="100" fixed="right">
                      <template #default="scope">
                        <el-button type="primary" link size="small" @click="handleLocateOnMap(scope.row)">
                          <el-icon><Location /></el-icon>
                          定位
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </el-card>
              </el-col>

              <el-col :span="8">
                <!-- 差异统计 -->
                <el-card shadow="hover" class="stats-card">
                  <template #header>统计概览</template>
                  <div v-if="differenceResultData.length" class="stats-list">
                    <div class="stat-item">
                      <div class="stat-label">检测地块总数</div>
                      <div class="stat-value primary">{{ differenceStats.total }}</div>
                    </div>
                    <el-divider />
                    <div class="stat-item">
                      <div class="stat-label">类型不符</div>
                      <div class="stat-value warning">{{ differenceStats.typeMismatch }}</div>
                    </div>
                    <el-divider />
                    <div class="stat-item">
                      <div class="stat-label">撂荒/未种植</div>
                      <div class="stat-value danger">{{ differenceStats.abandoned }}</div>
                    </div>
                    <el-divider />
                    <div class="stat-item">
                      <div class="stat-label">非规划种植</div>
                      <div class="stat-value info">{{ differenceStats.unplanned }}</div>
                    </div>
                    <el-divider />
                    <div class="stat-item">
                      <div class="stat-label">正常</div>
                      <div class="stat-value success">{{ differenceStats.normal }}</div>
                    </div>
                  </div>
                  <el-empty v-else description="暂无数据" :image-size="100" />
                </el-card>

                <!-- 差异分布图 -->
                <el-card shadow="hover" style="margin-top: 20px;">
                  <template #header>差异类型分布</template>
                  <div v-if="differenceResultData.length" style="height: 250px; display: flex; align-items: center; justify-content: center;">
                    <el-text type="info">图表区域（可集成 ECharts）</el-text>
                  </div>
                  <el-empty v-else description="暂无数据" :image-size="100" />
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>

        <!-- Tab 2: 时序变化分析 -->
        <el-tab-pane label="时序变化分析" name="temporal">
          <div class="analysis-content">
            <el-row :gutter="20">
              <el-col :span="16">
                <el-card shadow="hover">
                  <template #header>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>时序对比配置</span>
                      <el-button type="primary" @click="handleRunTemporalAnalysis" :loading="temporalLoading">
                        <template #icon><Play :size="14" /></template>
                        {{ temporalLoading ? '分析中...' : '执行分析' }}
                      </el-button>
                    </div>
                  </template>

                  <el-form label-width="120px">
                    <el-form-item label="基准任务">
                      <el-input :value="selectedTask.name" disabled />
                    </el-form-item>
                    <el-form-item label="对比任务">
                      <el-select v-model="temporalConfig.compareTaskId" placeholder="选择另一个年份的任务" style="width: 100%">
                        <el-option 
                          v-for="task in completedTasks.filter(t => t.id !== selectedTask.id)" 
                          :key="task.id"
                          :label="task.name" 
                          :value="task.id" 
                        />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="对比维度">
                      <el-checkbox-group v-model="temporalConfig.dimensions">
                        <el-checkbox label="cropChange">作物类型变化</el-checkbox>
                        <el-checkbox label="areaChange">种植面积变化</el-checkbox>
                        <el-checkbox label="coverageChange">植被覆盖变化</el-checkbox>
                      </el-checkbox-group>
                    </el-form-item>
                  </el-form>
                </el-card>

                <!-- 时序变化结果 -->
                <el-card v-if="temporalResultData.length" shadow="hover" style="margin-top: 20px;">
                  <template #header>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>变化检测结果</span>
                      <el-button size="small" @click="handleExportTemporal">
                        <template #icon><Download :size="14" /></template>
                        导出
                      </el-button>
                    </div>
                  </template>

                  <el-table :data="temporalResultData" max-height="400" stripe>
                    <el-table-column prop="plotId" label="地块编号" width="100" />
                    <el-table-column prop="plotName" label="地块名称" width="140" />
                    <el-table-column label="基准期作物" width="110">
                      <template #default="scope">
                        <el-tag size="small">{{ scope.row.baseCrop }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="对比期作物" width="110">
                      <template #default="scope">
                        <el-tag size="small" type="success">{{ scope.row.compareCrop }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="变化类型" width="120">
                      <template #default="scope">
                        <el-tag :type="scope.row.changeType === 'noChange' ? 'info' : 'warning'" size="small">
                          {{ scope.row.changeType === 'noChange' ? '无变化' : '作物变化' }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column prop="area" label="面积(亩)" width="100" />
                    <el-table-column label="操作" width="100" fixed="right">
                      <template #default="scope">
                        <el-button type="primary" link size="small" @click="handleLocateOnMap(scope.row)">
                          <el-icon><Location /></el-icon>
                          定位
                        </el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </el-card>
              </el-col>

              <el-col :span="8">
                <el-card shadow="hover" class="stats-card">
                  <template #header>变化统计</template>
                  <div v-if="temporalResultData.length" class="stats-list">
                    <div class="stat-item">
                      <div class="stat-label">对比地块总数</div>
                      <div class="stat-value primary">{{ temporalStats.total }}</div>
                    </div>
                    <el-divider />
                    <div class="stat-item">
                      <div class="stat-label">发生变化</div>
                      <div class="stat-value warning">{{ temporalStats.changed }}</div>
                    </div>
                    <el-divider />
                    <div class="stat-item">
                      <div class="stat-label">无变化</div>
                      <div class="stat-value success">{{ temporalStats.unchanged }}</div>
                    </div>
                  </div>
                  <el-empty v-else description="暂无数据" :image-size="100" />
                </el-card>

                <el-card shadow="hover" style="margin-top: 20px;">
                  <template #header>变化趋势</template>
                  <div v-if="temporalResultData.length" style="height: 250px; display: flex; align-items: center; justify-content: center;">
                    <el-text type="info">图表区域（可集成 ECharts）</el-text>
                  </div>
                  <el-empty v-else description="暂无数据" :image-size="100" />
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>

        <!-- Tab 3: 统计汇总 -->
        <el-tab-pane label="统计汇总" name="statistics">
          <div class="analysis-content">
            <el-row :gutter="20">
              <el-col :span="24">
                <el-card shadow="hover">
                  <template #header>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>统计维度选择</span>
                      <el-button type="primary" @click="handleGenerateStatistics" :loading="statisticsLoading">
                        <template #icon><DataAnalysis /></template>
                        {{ statisticsLoading ? '生成中...' : '生成统计' }}
                      </el-button>
                    </div>
                  </template>

                  <el-form :inline="true">
                    <el-form-item label="统计依据">
                      <el-radio-group v-model="statisticsConfig.source">
                        <el-radio label="difference">种植差异检测结果</el-radio>
                        <el-radio label="temporal">时序变化分析结果</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item label="统计维度">
                      <el-checkbox-group v-model="statisticsConfig.dimensions">
                        <el-checkbox label="region">按行政区划</el-checkbox>
                        <el-checkbox label="crop">按作物类型</el-checkbox>
                        <el-checkbox label="diffType">按差异类型</el-checkbox>
                      </el-checkbox-group>
                    </el-form-item>
                  </el-form>
                </el-card>

                <!-- 统计结果展示 -->
                <el-row v-if="statisticsData.length" :gutter="20" style="margin-top: 20px;">
                  <el-col :span="12">
                    <el-card shadow="hover">
                      <template #header>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                          <span>统计表格</span>
                          <el-button size="small" @click="handleExportStatistics">
                            <template #icon><Download :size="14" /></template>
                            导出
                          </el-button>
                        </div>
                      </template>
                      <el-table :data="statisticsData" max-height="450" stripe>
                        <el-table-column prop="category" label="分类" width="150" />
                        <el-table-column prop="count" label="地块数" width="100" />
                        <el-table-column prop="area" label="面积(亩)" width="120" />
                        <el-table-column prop="percentage" label="占比" width="100">
                          <template #default="scope">
                            {{ scope.row.percentage }}%
                          </template>
                        </el-table-column>
                      </el-table>
                    </el-card>
                  </el-col>

                  <el-col :span="12">
                    <el-card shadow="hover">
                      <template #header>统计图表</template>
                      <div style="height: 450px; display: flex; align-items: center; justify-content: center;">
                        <el-text type="info">图表区域（可集成 ECharts 饼图/柱状图）</el-text>
                      </div>
                    </el-card>
                  </el-col>
                </el-row>
              </el-col>
            </el-row>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 新建任务对话框 -->
    <el-dialog
      v-model="showTaskDialog"
      title="新建作物识别任务"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-steps :active="currentStep" finish-status="success" align-center>
        <el-step title="基本信息" />
        <el-step title="选择数据" />
        <el-step title="配置参数" />
        <el-step title="确认提交" />
      </el-steps>

      <div class="step-content">
        <!-- 步骤1: 基本信息 -->
        <div v-show="currentStep === 0" class="step-panel">
          <el-form :model="taskForm" label-width="100px">
            <el-form-item label="任务名称">
              <el-input v-model="taskForm.name" placeholder="请输入任务名称" />
            </el-form-item>
            <el-form-item label="任务描述">
              <el-input
                v-model="taskForm.description"
                type="textarea"
                :rows="3"
                placeholder="请输入任务描述"
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- 步骤2: 选择数据 -->
        <div v-show="currentStep === 1" class="step-panel">
          <el-form :model="taskForm" label-width="100px">
            <el-form-item label="影像数据">
              <el-select v-model="taskForm.imageId" placeholder="选择影像" style="width: 100%">
                <el-option label="Sentinel2_XJ_20240315_L2A" value="img001" />
                <el-option label="Landsat8_XJ_20240312_T1" value="img002" />
              </el-select>
            </el-form-item>
            <el-form-item label="地块数据">
              <el-select v-model="taskForm.plotId" placeholder="选择地块" style="width: 100%">
                <el-option label="乌鲁木齐市地块数据" value="plot001" />
                <el-option label="喀什地区地块数据" value="plot002" />
              </el-select>
            </el-form-item>
            <el-form-item label="训练样本">
              <el-upload
                class="upload-demo"
                drag
                :auto-upload="false"
                accept=".shp,.geojson"
              >
                <el-icon class="el-icon--upload"><Upload :size="20" /></el-icon>
                <div class="el-upload__text">拖拽文件到此处或<em>点击上传</em></div>
                <template #tip>
                  <div class="el-upload__tip">支持 .shp, .geojson 格式</div>
                </template>
              </el-upload>
            </el-form-item>
          </el-form>
        </div>

        <!-- 步骤3: 配置参数 -->
        <div v-show="currentStep === 2" class="step-panel">
          <el-form :model="taskForm" label-width="120px">
            <el-form-item label="分类方法">
              <el-radio-group v-model="taskForm.method">
                <el-radio label="RF">随机森林 (RF)</el-radio>
                <el-radio label="SVM">支持向量机 (SVM)</el-radio>
                <el-radio label="DeepLearning">深度学习</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="taskForm.method === 'RF'" label="决策树数量">
              <el-input-number v-model="taskForm.params.trees" :min="10" :max="1000" />
            </el-form-item>
            <el-form-item v-if="taskForm.method === 'SVM'" label="核函数">
              <el-select v-model="taskForm.params.kernel" style="width: 200px">
                <el-option label="RBF" value="rbf" />
                <el-option label="Linear" value="linear" />
                <el-option label="Polynomial" value="poly" />
              </el-select>
            </el-form-item>
            <el-form-item label="训练比例">
              <el-slider v-model="taskForm.params.trainRatio" :min="50" :max="90" />
              <span style="margin-left: 10px">{{ taskForm.params.trainRatio }}%</span>
            </el-form-item>
          </el-form>
        </div>

        <!-- 步骤4: 确认提交 -->
        <div v-show="currentStep === 3" class="step-panel">
          <el-descriptions title="任务配置信息" :column="1" border>
            <el-descriptions-item label="任务名称">{{ taskForm.name }}</el-descriptions-item>
            <el-descriptions-item label="任务描述">{{ taskForm.description }}</el-descriptions-item>
            <el-descriptions-item label="分类方法">{{ taskForm.method }}</el-descriptions-item>
            <el-descriptions-item label="影像数据">{{ taskForm.imageId }}</el-descriptions-item>
            <el-descriptions-item label="地块数据">{{ taskForm.plotId }}</el-descriptions-item>
          </el-descriptions>
        </div>
      </div>

      <template #footer>
        <el-button v-if="currentStep > 0" @click="currentStep--">上一步</el-button>
        <el-button @click="showTaskDialog = false">取消</el-button>
        <el-button v-if="currentStep < 3" type="primary" @click="currentStep++">下一步</el-button>
        <el-button v-else type="primary" @click="handleSubmitTask">提交任务</el-button>
      </template>
    </el-dialog>

    <!-- 日志查看对话框 -->
    <el-dialog v-model="showLogDialog" title="任务日志" width="800px">
      <div class="log-container">
        <pre>{{ currentLog }}</pre>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, RefreshCw, Search, Eye, File, Play, Trash2, Upload, Download, GitCompare
} from 'lucide-vue-next'
import {
  Tickets, Loading, CircleCheck, CircleClose, List, DataAnalysis, Location
} from '@element-plus/icons-vue'

const statusFilter = ref('')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const showTaskDialog = ref(false)
const showLogDialog = ref(false)
const currentStep = ref(0)
const currentLog = ref('')

// 新模块：变化检测与差异分析
const selectedTask = ref(null)
const activeAnalysisTab = ref('difference')

// 功能B.1：种植差异检测
const differenceLoading = ref(false)
const differenceTypeFilter = ref('')
const differenceConfig = ref({
  plotData: 'plot001',
  threshold: 80
})
const differenceResultData = ref([])
const differenceStats = ref({
  total: 0,
  typeMismatch: 0,
  abandoned: 0,
  unplanned: 0,
  normal: 0
})

// 功能B.2：时序变化分析
const temporalLoading = ref(false)
const temporalConfig = ref({
  compareTaskId: '',
  dimensions: ['cropChange']
})
const temporalResultData = ref([])
const temporalStats = ref({
  total: 0,
  changed: 0,
  unchanged: 0
})

// 功能B.3：统计汇总
const statisticsLoading = ref(false)
const statisticsConfig = ref({
  source: 'difference',
  dimensions: ['region']
})
const statisticsData = ref([])

const taskForm = ref({
  name: '',
  description: '',
  imageId: '',
  plotId: '',
  method: 'RF',
  params: {
    trees: 100,
    kernel: 'rbf',
    trainRatio: 70
  }
})

const taskList = ref([
  {
    id: 'TASK001',
    name: '2024年春季小麦识别',
    method: 'RF',
    status: 'completed',
    progress: 100,
    createTime: '2024-03-15 10:30:00',
    duration: '25分钟'
  },
  {
    id: 'TASK002',
    name: '棉花种植区域提取',
    method: 'SVM',
    status: 'running',
    progress: 65,
    createTime: '2024-03-15 14:20:00',
    duration: '15分钟'
  },
  {
    id: 'TASK003',
    name: '玉米地块分类识别',
    method: 'DeepLearning',
    status: 'pending',
    progress: 0,
    createTime: '2024-03-15 15:00:00',
    duration: '-'
  },
  {
    id: 'TASK004',
    name: '综合作物类型分类',
    method: 'RF',
    status: 'failed',
    progress: 45,
    createTime: '2024-03-14 16:30:00',
    duration: '10分钟'
  }
])

// 计算属性：过滤后的任务列表（根据状态和搜索关键字）
const filteredTaskList = computed(() => {
  let filtered = taskList.value

  // 按状态筛选
  if (statusFilter.value) {
    filtered = filtered.filter(task => task.status === statusFilter.value)
  }

  // 按名称搜索
  if (searchKeyword.value) {
    filtered = filtered.filter(task => 
      task.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
    )
  }

  return filtered
})

// 计算属性：分页后的任务列表
const paginatedTaskList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredTaskList.value.slice(start, end)
})

// 计算属性：任务总数（用于分页）
const totalTasks = computed(() => {
  return filteredTaskList.value.length
})

// 计算属性：动态统计任务状态
const taskStats = computed(() => {
  return {
    total: taskList.value.length,
    running: taskList.value.filter(t => t.status === 'running').length,
    completed: taskList.value.filter(t => t.status === 'completed').length,
    failed: taskList.value.filter(t => t.status === 'failed').length,
    pending: taskList.value.filter(t => t.status === 'pending').length
  }
})

// 计算属性：已完成的任务列表
const completedTasks = computed(() => {
  return taskList.value.filter(t => t.status === 'completed')
})

// 计算属性：过滤后的差异检测数据
const filteredDifferenceData = computed(() => {
  if (!differenceTypeFilter.value) {
    return differenceResultData.value
  }
  return differenceResultData.value.filter(r => r.diffType === differenceTypeFilter.value)
})

// 计算属性：判断是否有分析数据
const hasAnalysisData = computed(() => {
  return selectedTask.value !== null || 
         differenceResultData.value.length > 0 || 
         temporalResultData.value.length > 0 || 
         statisticsData.value.length > 0
})

// 监听筛选条件变化，自动重置到第一页
watch([statusFilter, searchKeyword], () => {
  currentPage.value = 1
})

// LocalStorage 键名
const STORAGE_KEY = 'task_analysis_data'

// 保存分析数据到 localStorage
const saveAnalysisData = () => {
  const data = {
    selectedTask: selectedTask.value,
    activeAnalysisTab: activeAnalysisTab.value,
    differenceResultData: differenceResultData.value,
    differenceStats: differenceStats.value,
    differenceConfig: differenceConfig.value,
    temporalResultData: temporalResultData.value,
    temporalStats: temporalStats.value,
    temporalConfig: temporalConfig.value,
    statisticsData: statisticsData.value,
    statisticsConfig: statisticsConfig.value,
    timestamp: new Date().getTime()
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('保存分析数据失败:', error)
  }
}

// 从 localStorage 加载分析数据
const loadAnalysisData = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      
      // 检查数据是否过期（24小时）
      const now = new Date().getTime()
      const oneDayMs = 24 * 60 * 60 * 1000
      if (data.timestamp && (now - data.timestamp) < oneDayMs) {
        selectedTask.value = data.selectedTask
        activeAnalysisTab.value = data.activeAnalysisTab || 'difference'
        differenceResultData.value = data.differenceResultData || []
        differenceStats.value = data.differenceStats || {
          total: 0,
          typeMismatch: 0,
          abandoned: 0,
          unplanned: 0,
          normal: 0
        }
        differenceConfig.value = data.differenceConfig || {
          plotData: 'plot001',
          threshold: 80
        }
        temporalResultData.value = data.temporalResultData || []
        temporalStats.value = data.temporalStats || {
          total: 0,
          changed: 0,
          unchanged: 0
        }
        temporalConfig.value = data.temporalConfig || {
          compareTaskId: '',
          dimensions: ['cropChange']
        }
        statisticsData.value = data.statisticsData || []
        statisticsConfig.value = data.statisticsConfig || {
          source: 'difference',
          dimensions: ['region']
        }
        
        console.log('已恢复分析数据')
      } else {
        console.log('分析数据已过期，已清除')
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  } catch (error) {
    console.error('加载分析数据失败:', error)
    localStorage.removeItem(STORAGE_KEY)
  }
}

// 清空所有分析数据
const clearAnalysisData = () => {
  selectedTask.value = null
  activeAnalysisTab.value = 'difference'
  differenceResultData.value = []
  differenceStats.value = {
    total: 0,
    typeMismatch: 0,
    abandoned: 0,
    unplanned: 0,
    normal: 0
  }
  differenceConfig.value = {
    plotData: 'plot001',
    threshold: 80
  }
  temporalResultData.value = []
  temporalStats.value = {
    total: 0,
    changed: 0,
    unchanged: 0
  }
  temporalConfig.value = {
    compareTaskId: '',
    dimensions: ['cropChange']
  }
  statisticsData.value = []
  statisticsConfig.value = {
    source: 'difference',
    dimensions: ['region']
  }
  differenceTypeFilter.value = ''
  
  // 清除 localStorage
  localStorage.removeItem(STORAGE_KEY)
}

// 监听关键数据变化，自动保存
watch([
  selectedTask, 
  differenceResultData, 
  temporalResultData, 
  statisticsData,
  activeAnalysisTab
], () => {
  saveAnalysisData()
}, { deep: true })

// 组件挂载时恢复数据
onMounted(() => {
  loadAnalysisData()
})

const getStatusType = (status) => {
  const map = {
    pending: 'info',
    running: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return map[status]
}

const getStatusIcon = (status) => {
  const map = {
    pending: 'Clock',
    running: 'Loading',
    completed: 'CircleCheck',
    failed: 'CircleClose'
  }
  return map[status]
}

const getStatusText = (status) => {
  const map = {
    pending: '排队中',
    running: '运行中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status]
}

const handleRefresh = () => {
  // 清空筛选条件
  statusFilter.value = ''
  searchKeyword.value = ''
  currentPage.value = 1
  ElMessage.success('列表已刷新')
}

const handleViewResult = (row) => {
  ElMessage.success(`查看任务 ${row.name} 的结果`)
}

const handleViewLog = (row) => {
  currentLog.value = `[2024-03-15 10:30:00] 任务开始执行...\n[2024-03-15 10:31:23] 加载影像数据...\n[2024-03-15 10:33:45] 加载地块数据...\n[2024-03-15 10:35:12] 数据预处理完成\n[2024-03-15 10:38:56] 模型训练中...\n[2024-03-15 10:50:34] 模型训练完成\n[2024-03-15 10:52:18] 执行分类预测...\n[2024-03-15 10:55:00] 任务执行成功`
  showLogDialog.value = true
}

const handleStop = (row) => {
  ElMessageBox.confirm(`确定要停止任务 ${row.name} 吗？`, '停止确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    ElMessage.success('任务已停止')
  })
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除任务 ${row.name} 吗？`, '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    ElMessage.success('删除成功')
  })
}

const handleSubmitTask = () => {
  ElMessage.success('任务提交成功')
  showTaskDialog.value = false
  currentStep.value = 0
  taskForm.value = {
    name: '',
    description: '',
    imageId: '',
    plotId: '',
    method: 'RF',
    params: {
      trees: 100,
      kernel: 'rbf',
      trainRatio: 70
    }
  }
}

// 获取差异类型标签样式
const getDiffTagType = (diffType) => {
  const map = {
    normal: 'success',
    typeMismatch: 'warning',
    abandoned: 'danger',
    unplanned: 'info'
  }
  return map[diffType]
}

// 获取差异类型文本
const getDiffTypeText = (diffType) => {
  const map = {
    normal: '正常',
    typeMismatch: '类型不符',
    abandoned: '撂荒/未种植',
    unplanned: '非规划种植'
  }
  return map[diffType]
}

// ============ 新模块方法 ============

// 选择任务用于分析
const handleSelectTask = (task) => {
  selectedTask.value = task
  ElMessage.success(`已选择任务: ${task.name}`)
  // 滚动到分析模块
  setTimeout(() => {
    const analysisModule = document.querySelector('.analysis-module-card')
    if (analysisModule) {
      analysisModule.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, 100)
}

// 滚动到任务列表
const scrollToTaskList = () => {
  console.log('点击了前往选择任务按钮')
  // 滚动到页面顶部
  window.scrollTo({ 
    top: 0, 
    behavior: 'smooth' 
  })
  // 或者尝试滚动到任务列表卡片
  setTimeout(() => {
    const taskListCard = document.querySelector('.task-list-card')
    if (taskListCard) {
      taskListCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, 100)
  ElMessage.info('已定位到任务列表')
}

// 功能B.1：执行种植差异检测
const handleRunDifferenceDetection = () => {
  if (!selectedTask.value) {
    ElMessage.warning('请先选择一个分析任务')
    return
  }

  differenceLoading.value = true

  // 模拟API调用
  setTimeout(() => {
    const mockData = [
      {
        plotId: 'P0001',
        plotName: '张家地块A区',
        plannedCrop: '小麦',
        detectedCrop: '水稻',
        confidence: 0.92,
        diffType: 'typeMismatch',
        area: 125.5
      },
      {
        plotId: 'P0002',
        plotName: '李家地块B区',
        plannedCrop: '玉米',
        detectedCrop: '裸地',
        confidence: 0.88,
        diffType: 'abandoned',
        area: 86.3
      },
      {
        plotId: 'P0003',
        plotName: '王家地块C区',
        plannedCrop: '休耕',
        detectedCrop: '棉花',
        confidence: 0.85,
        diffType: 'unplanned',
        area: 156.8
      },
      {
        plotId: 'P0004',
        plotName: '赵家地块D区',
        plannedCrop: '小麦',
        detectedCrop: '小麦',
        confidence: 0.95,
        diffType: 'normal',
        area: 98.2
      },
      {
        plotId: 'P0005',
        plotName: '陈家地块E区',
        plannedCrop: '棉花',
        detectedCrop: '玉米',
        confidence: 0.91,
        diffType: 'typeMismatch',
        area: 142.6
      },
      {
        plotId: 'P0006',
        plotName: '刘家地块F区',
        plannedCrop: '水稻',
        detectedCrop: '低植被',
        confidence: 0.83,
        diffType: 'abandoned',
        area: 76.4
      },
      {
        plotId: 'P0007',
        plotName: '杨家地块G区',
        plannedCrop: '玉米',
        detectedCrop: '玉米',
        confidence: 0.94,
        diffType: 'normal',
        area: 113.7
      },
      {
        plotId: 'P0008',
        plotName: '周家地块H区',
        plannedCrop: '非农用地',
        detectedCrop: '蔬菜',
        confidence: 0.87,
        diffType: 'unplanned',
        area: 45.9
      }
    ]

    differenceResultData.value = mockData

    // 计算统计数据
    differenceStats.value = {
      total: mockData.length,
      typeMismatch: mockData.filter(r => r.diffType === 'typeMismatch').length,
      abandoned: mockData.filter(r => r.diffType === 'abandoned').length,
      unplanned: mockData.filter(r => r.diffType === 'unplanned').length,
      normal: mockData.filter(r => r.diffType === 'normal').length
    }

    differenceLoading.value = false
    ElMessage.success('差异检测完成！')
  }, 2000)
}

// 功能B.2：执行时序变化分析
const handleRunTemporalAnalysis = () => {
  if (!selectedTask.value) {
    ElMessage.warning('请先选择一个基准任务')
    return
  }

  if (!temporalConfig.value.compareTaskId) {
    ElMessage.warning('请选择对比任务')
    return
  }

  temporalLoading.value = true

  // 模拟API调用
  setTimeout(() => {
    const mockData = [
      {
        plotId: 'P0001',
        plotName: '张家地块A区',
        baseCrop: '小麦',
        compareCrop: '水稻',
        changeType: 'changed',
        area: 125.5
      },
      {
        plotId: 'P0002',
        plotName: '李家地块B区',
        baseCrop: '玉米',
        compareCrop: '玉米',
        changeType: 'noChange',
        area: 86.3
      },
      {
        plotId: 'P0003',
        plotName: '王家地块C区',
        baseCrop: '水稻',
        compareCrop: '棉花',
        changeType: 'changed',
        area: 156.8
      },
      {
        plotId: 'P0004',
        plotName: '赵家地块D区',
        baseCrop: '小麦',
        compareCrop: '小麦',
        changeType: 'noChange',
        area: 98.2
      },
      {
        plotId: 'P0005',
        plotName: '陈家地块E区',
        baseCrop: '棉花',
        compareCrop: '玉米',
        changeType: 'changed',
        area: 142.6
      }
    ]

    temporalResultData.value = mockData

    // 计算统计
    temporalStats.value = {
      total: mockData.length,
      changed: mockData.filter(r => r.changeType === 'changed').length,
      unchanged: mockData.filter(r => r.changeType === 'noChange').length
    }

    temporalLoading.value = false
    ElMessage.success('时序变化分析完成！')
  }, 2000)
}

// 功能B.3：生成统计汇总
const handleGenerateStatistics = () => {
  if (statisticsConfig.value.source === 'difference' && !differenceResultData.value.length) {
    ElMessage.warning('请先执行种植差异检测')
    return
  }

  if (statisticsConfig.value.source === 'temporal' && !temporalResultData.value.length) {
    ElMessage.warning('请先执行时序变化分析')
    return
  }

  statisticsLoading.value = true

  // 模拟生成统计数据
  setTimeout(() => {
    const mockData = [
      { category: '类型不符', count: 2, area: 268.1, percentage: 35.2 },
      { category: '撂荒/未种植', count: 2, area: 162.7, percentage: 21.4 },
      { category: '非规划种植', count: 2, area: 202.7, percentage: 26.6 },
      { category: '正常', count: 2, area: 211.9, percentage: 27.8 }
    ]

    statisticsData.value = mockData
    statisticsLoading.value = false
    ElMessage.success('统计汇总生成完成！')
  }, 1500)
}

// 导出差异检测结果
const handleExportDifference = () => {
  if (!differenceResultData.value.length) {
    ElMessage.warning('暂无数据可导出')
    return
  }
  
  ElMessageBox.confirm(
    '请选择导出格式',
    '导出差异检测结果',
    {
      distinguishCancelAndClose: true,
      confirmButtonText: '导出为 SHP',
      cancelButtonText: '导出为 KMZ',
      type: 'info'
    }
  ).then(() => {
    // 导出为 SHP
    exportAnalysisResult('difference', 'shp')
  }).catch((action) => {
    if (action === 'cancel') {
      // 导出为 KMZ
      exportAnalysisResult('difference', 'kmz')
    }
  })
}

// 导出时序分析结果
const handleExportTemporal = () => {
  if (!temporalResultData.value.length) {
    ElMessage.warning('暂无数据可导出')
    return
  }
  
  ElMessageBox.confirm(
    '请选择导出格式',
    '导出时序变化结果',
    {
      distinguishCancelAndClose: true,
      confirmButtonText: '导出为 SHP',
      cancelButtonText: '导出为 KMZ',
      type: 'info'
    }
  ).then(() => {
    exportAnalysisResult('temporal', 'shp')
  }).catch((action) => {
    if (action === 'cancel') {
      exportAnalysisResult('temporal', 'kmz')
    }
  })
}

// 导出统计汇总
const handleExportStatistics = () => {
  if (!statisticsData.value.length) {
    ElMessage.warning('暂无数据可导出')
    return
  }
  
  ElMessageBox.confirm(
    '请选择导出格式',
    '导出统计汇总结果',
    {
      distinguishCancelAndClose: true,
      confirmButtonText: '导出为 SHP',
      cancelButtonText: '导出为 KMZ',
      type: 'info'
    }
  ).then(() => {
    exportAnalysisResult('statistics', 'shp')
  }).catch((action) => {
    if (action === 'cancel') {
      exportAnalysisResult('statistics', 'kmz')
    }
  })
}

// 在地图上定位
const handleLocateOnMap = (row) => {
  ElMessage.info(`定位到地块: ${row.plotName}`)
}

// 统一的导出分析结果函数
const exportAnalysisResult = (type, format) => {
  let data, fileName, description
  
  switch(type) {
    case 'difference':
      data = differenceResultData.value
      fileName = `差异检测结果_${selectedTask.value?.name || '未命名'}_${new Date().getTime()}`
      description = `差异检测分析 - ${selectedTask.value?.name}`
      break
    case 'temporal':
      data = temporalResultData.value
      fileName = `时序变化结果_${selectedTask.value?.name || '未命名'}_${new Date().getTime()}`
      description = `时序变化分析 - ${selectedTask.value?.name}`
      break
    case 'statistics':
      data = statisticsData.value
      fileName = `统计汇总结果_${selectedTask.value?.name || '未命名'}_${new Date().getTime()}`
      description = `统计汇总分析 - ${selectedTask.value?.name}`
      break
  }
  
  // 模拟文件生成（实际项目中应该调用后端API）
  const fileInfo = {
    id: `result_${new Date().getTime()}`,
    name: `${fileName}.${format}`,
    type: format.toUpperCase(),
    size: `${(Math.random() * 10 + 1).toFixed(2)} MB`,
    createTime: new Date().toLocaleString('zh-CN'),
    description: description,
    taskId: selectedTask.value?.id,
    taskName: selectedTask.value?.name,
    analysisType: type,
    recordCount: data.length,
    downloadUrl: `/api/download/${fileName}.${format}` // 模拟下载链接
  }
  
  // 保存到分析结果队列（localStorage）
  saveAnalysisResultToQueue(fileInfo)
  
  // 模拟文件下载
  ElMessage.success({
    message: `正在导出 ${format.toUpperCase()} 格式文件...`,
    duration: 2000
  })
  
  setTimeout(() => {
    ElMessage.success({
      message: `${fileName}.${format} 导出成功！已添加到数据管理的分析结果队列`,
      duration: 3000
    })
  }, 2000)
}

// 保存分析结果到队列
const saveAnalysisResultToQueue = (fileInfo) => {
  try {
    const QUEUE_KEY = 'analysis_result_queue'
    let queue = []
    
    const stored = localStorage.getItem(QUEUE_KEY)
    if (stored) {
      queue = JSON.parse(stored)
    }
    
    // 添加新结果到队列头部
    queue.unshift(fileInfo)
    
    // 限制队列长度（最多保留50条）
    if (queue.length > 50) {
      queue = queue.slice(0, 50)
    }
    
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    console.log('分析结果已保存到队列:', fileInfo)
  } catch (error) {
    console.error('保存分析结果失败:', error)
  }
}

// 一键清空所有分析数据
const handleClearAllData = () => {
  ElMessageBox.confirm(
    '清空后将删除所有分析数据（包括选中的任务、差异检测结果、时序分析结果和统计数据），此操作不可恢复，是否继续？',
    '确认清空',
    {
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(() => {
    clearAnalysisData()
    ElMessage.success({
      message: '所有分析数据已清空',
      duration: 3000
    })
  }).catch(() => {
    // 用户取消操作，不显示提示或者只显示3秒
    // ElMessage.info({
    //   message: '已取消清空操作',
    //   duration: 3000
    // })
  })
}
</script>

<style scoped lang="scss">
.task-management-container {
  .action-card {
    margin-bottom: 20px;
    border-radius: 8px;
  }
  
  .stats-row {
    margin-bottom: 20px;
    
    .stat-card {
      border-radius: 8px;
      
      &.stat-all {
        border-left: 4px solid #409EFF;
      }
      
      &.stat-running {
        border-left: 4px solid #E6A23C;
      }
      
      &.stat-completed {
        border-left: 4px solid #67C23A;
      }
      
      &.stat-failed {
        border-left: 4px solid #F56C6C;
      }
    }
  }
  
  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }
  
  .step-content {
    margin: 30px 0;
    min-height: 300px;
    
    .step-panel {
      padding: 20px;
    }
  }
  
  .log-container {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 15px;
    border-radius: 4px;
    max-height: 500px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  }
}

// 差异检测相关样式
.difference-detection-container {
  .config-card {
    margin-bottom: 20px;
    border-radius: 8px;
  }
  
  .difference-stats {
    margin: 20px 0;
    
    .diff-stat-card {
      border-radius: 8px;
      
      &.diff-total {
        border-left: 4px solid #409EFF;
      }
      
      &.diff-mismatch {
        border-left: 4px solid #E6A23C;
      }
      
      &.diff-abandoned {
        border-left: 4px solid #F56C6C;
      }
      
      &.diff-unplanned {
        border-left: 4px solid #909399;
      }
    }
  }
  
  .results-card {
    border-radius: 8px;
  }
}

// 新模块：变化检测与差异分析样式
.analysis-module-card {
  margin-top: 30px;
  border-radius: 8px;
  border: 2px solid #409EFF;
  
  .module-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .module-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .module-title {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
  
  .empty-state {
    padding: 40px 20px;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .analysis-tabs {
    margin-top: 20px;
    
    .analysis-content {
      padding: 20px 0;
    }
  }
  
  .stats-card {
    .stats-list {
      .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        
        .stat-label {
          font-size: 14px;
          color: #606266;
        }
        
        .stat-value {
          font-size: 24px;
          font-weight: 600;
          
          &.primary {
            color: #409EFF;
          }
          
          &.success {
            color: #67C23A;
          }
          
          &.warning {
            color: #E6A23C;
          }
          
          &.danger {
            color: #F56C6C;
          }
          
          &.info {
            color: #909399;
          }
        }
      }
    }
  }
}
</style>

