import { Request, Response } from 'express'
import { TasksService } from './tasks.service'
import { successResponse, createdResponse, errorResponse } from '../../utils/response'
import { AuthRequest } from '../../middleware/auth.middleware'
import { uploadTaskAttachment as uploadToStorage, deleteFile } from '../../utils/storage'
import { canUserManageBoard, canUserManageList, canUserManageTask } from '../../utils/rbac'

const tasksService = new TasksService()

export class TasksController {
  // Get all tasks
  async getAllTasks(req: AuthRequest, res: Response) {
    try {
      const tasks = await tasksService.getAllTasks()
      return successResponse(res, { tasks }, 'Tasks fetched successfully')
    } catch (error: any) {
      console.error('Get all tasks error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get user tasks
  async getUserTasks(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const tasks = await tasksService.getUserTasks(userId)
      return successResponse(res, { tasks }, 'User tasks fetched successfully')
    } catch (error: any) {
      console.error('Get user tasks error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Create task
  async createTask(req: AuthRequest, res: Response) {
    try {
      const { title, description, assigned_to, due_date, priority, status, project_id, list_id } = req.body

      if (!title || !assigned_to) {
        return errorResponse(res, 'Title and assigned_to are required', 400)
      }

      // Check RBAC permission
      const authorized = await canUserManageList(req.user.id, req.user.role, list_id)
      if (!authorized) {
        return errorResponse(res, 'Access denied: You are not authorized to create tasks on this board', 403)
      }

      const task = await tasksService.createTask({
        title,
        description,
        assigned_to,
        due_date,
        priority: priority || 'medium',
        status,
        project_id,
        list_id
      })

      return createdResponse(res, { task }, 'Task created successfully')
    } catch (error: any) {
      console.error('Create task error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Quick create task (for Kanban - minimal required fields)
  async quickCreateTask(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id
      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      const { title, list_id, project_id, board_id, position } = req.body

      if (!title || !list_id) {
        return errorResponse(res, 'Title and list_id are required', 400)
      }

      // Check RBAC permission
      let authorized = false
      if (board_id) {
        authorized = await canUserManageBoard(req.user.id, req.user.role, board_id)
      } else {
        authorized = await canUserManageList(req.user.id, req.user.role, list_id)
      }
      if (!authorized) {
        return errorResponse(res, 'Access denied: You are not authorized to create tasks on this board', 403)
      }

      const task = await tasksService.quickCreateTask({
        title,
        list_id,
        project_id,
        board_id,
        position,
        created_by: userId,
        assigned_to: userId // Auto-assign to creator
      })

      return createdResponse(res, { task }, 'Task created successfully')
    } catch (error: any) {
      console.error('Quick create task error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update task status
  async updateTaskStatus(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params
      const { status } = req.body

      if (!taskId || !status) {
        return errorResponse(res, 'Task ID and status are required', 400)
      }

      // Ensure taskId is a string
      const taskIdStr = Array.isArray(taskId) ? taskId[0] : taskId

      // Check RBAC permission
      const authorized = await canUserManageTask(req.user.id, req.user.role, taskIdStr)
      if (!authorized) {
        return errorResponse(res, 'Access denied: You are not authorized to move or update tasks on this board', 403)
      }

      const task = await tasksService.updateTaskStatus(taskIdStr, status)
      return successResponse(res, { task }, 'Task status updated successfully')
    } catch (error: any) {
      console.error('Update task status error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Move task between lists
  async moveTask(req: AuthRequest, res: Response) {
    try {
      const { task_id, source_list_id, destination_list_id, destination_position } = req.body

      if (!task_id || !destination_list_id) {
        return errorResponse(res, 'task_id and destination_list_id are required', 400)
      }

      // Check RBAC permission
      const authorized = await canUserManageTask(req.user.id, req.user.role, task_id)
      if (!authorized) {
        return errorResponse(res, 'Access denied: You are not authorized to move or update tasks on this board', 403)
      }

      const task = await tasksService.moveTask(task_id, destination_list_id, destination_position || 0)
      return successResponse(res, { task }, 'Task moved successfully')
    } catch (error: any) {
      console.error('Move task error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update task
  async updateTask(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params
      const updates = req.body
      const userId = req.user?.id

      if (!taskId) {
        return errorResponse(res, 'Task ID is required', 400)
      }

      // Ensure taskId is a string
      const taskIdStr = Array.isArray(taskId) ? taskId[0] : taskId

      // Check RBAC permission
      const authorized = await canUserManageTask(req.user.id, req.user.role, taskIdStr)
      if (!authorized) {
        return errorResponse(res, 'Access denied: You are not authorized to modify tasks on this board', 403)
      }

      const task = await tasksService.updateTask(taskIdStr, updates, userId)
      return successResponse(res, { task }, 'Task updated successfully')
    } catch (error: any) {
      console.error('Update task error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Delete task
  async deleteTask(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params

      if (!taskId) {
        return errorResponse(res, 'Task ID is required', 400)
      }

      // Ensure taskId is a string
      const taskIdStr = Array.isArray(taskId) ? taskId[0] : taskId

      // Check RBAC permission
      const authorized = await canUserManageTask(req.user.id, req.user.role, taskIdStr)
      if (!authorized) {
        return errorResponse(res, 'Access denied: You are not authorized to delete tasks on this board', 403)
      }

      await tasksService.deleteTask(taskIdStr)
      return successResponse(res, null, 'Task deleted successfully')
    } catch (error: any) {
      console.error('Delete task error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Bulk delete tasks
  async bulkDeleteTasks(req: AuthRequest, res: Response) {
    try {
      const { taskIds } = req.body

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return errorResponse(res, 'Task IDs array is required', 400)
      }

      // Check RBAC permission for each task
      for (const taskId of taskIds) {
        const authorized = await canUserManageTask(req.user.id, req.user.role, taskId)
        if (!authorized) {
          return errorResponse(res, `Access denied: You are not authorized to delete task: ${taskId}`, 403)
        }
      }

      await tasksService.bulkDeleteTasks(taskIds)
      return successResponse(res, null, 'Tasks deleted successfully')
    } catch (error: any) {
      console.error('Bulk delete tasks error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get task comments
  async getTaskComments(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params

      if (!taskId) {
        return errorResponse(res, 'Task ID is required', 400)
      }

      const comments = await tasksService.getTaskComments(taskId as string)
      return successResponse(res, { comments }, 'Comments fetched successfully')
    } catch (error: any) {
      console.error('Get comments error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Add task comment
  async addTaskComment(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params
      const { comment, attachments } = req.body
      const userId = req.user?.id

      if (!userId) {
        return errorResponse(res, 'User not authenticated', 401)
      }

      if (!comment || !taskId) {
        return errorResponse(res, 'Task ID and comment are required', 400)
      }

      const newComment = await tasksService.addTaskComment(taskId as string, userId, comment, attachments)
      return successResponse(res, { comment: newComment }, 'Comment added successfully')
    } catch (error: any) {
      console.error('Add comment error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Delete task comment
  async deleteTaskComment(req: AuthRequest, res: Response) {
    try {
      const { commentId } = req.params
      const userId = req.user?.id
      if (!commentId) return errorResponse(res, 'Comment ID is required', 400)
      await tasksService.deleteTaskComment(commentId as string, userId!)
      return successResponse(res, null, 'Comment deleted successfully')
    } catch (error: any) {
      console.error('Delete comment error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get task attachments
  async getTaskAttachments(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params

      if (!taskId) {
        return errorResponse(res, 'Task ID is required', 400)
      }

      const attachments = await tasksService.getTaskAttachments(taskId as string)
      return successResponse(res, { attachments }, 'Attachments fetched successfully')
    } catch (error: any) {
      console.error('Get attachments error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Upload task attachment
  async uploadTaskAttachment(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params
      const userId = req.user?.id
      const file = (req as any).file

      if (!taskId) return errorResponse(res, 'Task ID is required', 400)
      if (!userId) return errorResponse(res, 'User not authenticated', 401)
      if (!file) return errorResponse(res, 'No file uploaded', 400)

      const attachment = await tasksService.uploadTaskAttachment(taskId as string, userId as string, file)
      return createdResponse(res, { attachment }, 'Attachment uploaded successfully')
    } catch (error: any) {
      console.error('Upload attachment error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Delete task attachment
  async deleteTaskAttachment(req: AuthRequest, res: Response) {
    try {
      const { taskId, attachmentId } = req.params
      if (!taskId || !attachmentId) return errorResponse(res, 'Task ID and attachment ID are required', 400)

      await tasksService.deleteTaskAttachment(attachmentId as string)
      return successResponse(res, null, 'Attachment deleted successfully')
    } catch (error: any) {
      console.error('Delete attachment error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get task activities
  async getTaskActivities(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params

      if (!taskId) {
        return errorResponse(res, 'Task ID is required', 400)
      }

      const activities = await tasksService.getTaskActivities(taskId as string)
      return successResponse(res, { activities }, 'Activities fetched successfully')
    } catch (error: any) {
      console.error('Get activities error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get task members
  async getTaskMembers(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params

      if (!taskId) {
        return errorResponse(res, 'Task ID is required', 400)
      }

      const members = await tasksService.getTaskMembers(taskId as string)
      return successResponse(res, { members }, 'Task members fetched successfully')
    } catch (error: any) {
      console.error('Get task members error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Add task member
  async addTaskMember(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params
      const { user_id } = req.body

      if (!taskId || !user_id) {
        return errorResponse(res, 'Task ID and user ID are required', 400)
      }

      // Ensure taskId is a string
      const taskIdStr = Array.isArray(taskId) ? taskId[0] : taskId

      // Check RBAC permission
      const authorized = await canUserManageTask(req.user.id, req.user.role, taskIdStr)
      if (!authorized) {
        return errorResponse(res, 'Access denied: You are not authorized to assign members to tasks on this board', 403)
      }

      const member = await tasksService.addTaskMember(taskIdStr, user_id)
      return successResponse(res, { member }, 'Task member added successfully')
    } catch (error: any) {
      console.error('Add task member error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Remove task member
  async removeTaskMember(req: AuthRequest, res: Response) {
    try {
      const { taskId, userId } = req.params

      if (!taskId || !userId) {
        return errorResponse(res, 'Task ID and user ID are required', 400)
      }

      // Ensure taskId and userId are strings
      const taskIdStr = Array.isArray(taskId) ? taskId[0] : taskId
      const userIdStr = Array.isArray(userId) ? userId[0] : userId

      // Check RBAC permission
      const authorized = await canUserManageTask(req.user.id, req.user.role, taskIdStr)
      if (!authorized) {
        return errorResponse(res, 'Access denied: You are not authorized to assign members to tasks on this board', 403)
      }

      await tasksService.removeTaskMember(taskIdStr, userIdStr)
      return successResponse(res, null, 'Task member removed successfully')
    } catch (error: any) {
      console.error('Remove task member error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Get task checklist
  async getTaskChecklist(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params

      if (!taskId) {
        return errorResponse(res, 'Task ID is required', 400)
      }

      const items = await tasksService.getTaskChecklist(taskId as string)
      return successResponse(res, { items }, 'Checklist fetched successfully')
    } catch (error: any) {
      console.error('Get checklist error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Add checklist item
  async addChecklistItem(req: AuthRequest, res: Response) {
    try {
      const { taskId } = req.params
      const { text } = req.body

      if (!taskId || !text) {
        return errorResponse(res, 'Task ID and text are required', 400)
      }

      const item = await tasksService.addChecklistItem(taskId as string, text)
      return successResponse(res, { item }, 'Checklist item added successfully')
    } catch (error: any) {
      console.error('Add checklist item error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Update checklist item
  async updateChecklistItem(req: AuthRequest, res: Response) {
    try {
      const { itemId } = req.params
      const updates = req.body

      if (!itemId) {
        return errorResponse(res, 'Item ID is required', 400)
      }

      const item = await tasksService.updateChecklistItem(itemId as string, updates)
      return successResponse(res, { item }, 'Checklist item updated successfully')
    } catch (error: any) {
      console.error('Update checklist item error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Delete checklist item
  async deleteChecklistItem(req: AuthRequest, res: Response) {
    try {
      const { itemId } = req.params

      if (!itemId) {
        return errorResponse(res, 'Item ID is required', 400)
      }

      await tasksService.deleteChecklistItem(itemId as string)
      return successResponse(res, null, 'Checklist item deleted successfully')
    } catch (error: any) {
      console.error('Delete checklist item error:', error)
      return errorResponse(res, error.message, 500)
    }
  }

  // Reorder tasks (batch update positions)
  async reorderTasks(req: AuthRequest, res: Response) {
    try {
      const { tasks } = req.body

      if (!tasks || !Array.isArray(tasks)) {
        return errorResponse(res, 'Tasks array is required', 400)
      }

      await tasksService.reorderTasks(tasks)
      return successResponse(res, null, 'Tasks reordered successfully')
    } catch (error: any) {
      console.error('Reorder tasks error:', error)
      return errorResponse(res, error.message, 500)
    }
  }
}
