Ext.define('TSModel', {
    extend: 'Ext.data.Model',
    fields: [
        { name: 'Team', type:'string' },
        { name: 'User', type:'string' },
        { name: 'FormattedID', type:'string' },
        { name: 'Name', type:'string' },
        { name: 'WorkProduct', type:'string' },
        { name: 'WorkProductID', type:'string' },
        { name: 'State', type:'string' },
        { name: 'PercentageUsedEstimate', type:'number' },
        { name: 'PercentageUsedToDo', type:'number' },
        { name: 'Capacity', type:'number' },
        { name: 'Estimate', type:'number' },
        { name: 'ToDo', type:'number' }
    ]
});

Ext.define("TSApp", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box', layout:'hbox', padding: 10},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "TSApp"
    },
                        
     
    launch: function() {
        var me = this;
        me._addSelector();
    },
      
    _addSelector: function() {
        var me = this;
        var selector_box = this.down('#selector_box');
        selector_box.removeAll();
        selector_box.add({
            xtype:'rallyiterationcombobox',
            fieldLabel: 'Iteration:',
            width:500,
            margin:10,
            showArrows : false,
            context : this.getContext(),
            growToLongestValue : true,
            defaultToCurrentTimebox : true,
            listeners: {
                scope: me,
                change: function(icb) {
                    me.iteration = icb;
                    me._queryAndDisplayGrid();

                }
            }
        });

         selector_box.add({
            xtype:'rallybutton',
            itemId:'export_button',
            text: 'Download CSV',
            margin:10,

            disabled: false,
            iconAlign: 'right',
            listeners: {
                scope: me,
                click: function() {
                    me._export();
                }
            },
            margin: '10',
            scope: me
        });

    },      

    _queryAndDisplayGrid: function(){
        var me = this;
        me.setLoading("Loading");
        var model_name = 'Task',
            field_names = ['ObjectID','FormattedID','Name','Project','State','Owner','WorkProduct','ToDo','Estimate','Iteration','UserIterationCapacities','DisplayName',"FirstName",'LastName'],
            iteration_field_names = ['ObjectID','FormattedID','Name','Project','Iteration','Capacity','User','DisplayName',"FirstName",'LastName'],
            filters = [];
        var iteration_name = me.iteration.rawValue;

        filters = [{property:'Iteration.Name',value: iteration_name}];

        Deft.Promise.all([me._loadAStoreWithAPromise(model_name, field_names,filters),me._loadAStoreWithAPromise('UserIterationCapacity', iteration_field_names,filters)],me).then({
            scope: me,
            success: function(results) {
                
                //process results to create a custom grid. 

                var tasks = [];
                //var hash = {},
                var totalCapacity = 0;
                var totalEstimate = 0;
                var totalToDo = 0;
                // me.logger.log('uic',results[1]);

                var uic_hash = {};
                //var teamExists = null;
                Ext.Array.each(results[1],function(uic){
                    var userName = uic.get('User')  ? ((uic.get('User').FirstName ? uic.get('User').FirstName : "" ) + " " + (uic.get('User').LastName ? uic.get('User').LastName.slice(0,1) : "" )) : "No Owner Entry";
                    if(" "==userName){
                        userName = uic.get('User')._refObjectName;
                    }                    
                    // me.logger.log('userName',userName);
                    // teamExists = Ext.Array.filter(uic_hash, function(item) {
                    //     if(item.Team == uic.get('Project').Name){
                    //         item.Users.push({ObjectID: uic.get('ObjectID'), UserName: userName, Capacity: uic.get('Capacity')});
                    //         return true;   
                    //     }
                    // });

                    // if(teamExists.length < 1){
                    //     uic_hash.push({
                    //         Team: uic.get('Project').Name,
                    //         ObjectID: uic.get('Project').ObjectID,
                    //         Users: [{ObjectID: uic.get('ObjectID'), UserName: userName, Capacity: uic.get('Capacity')}]
                    //     });                        
                    // }

                    totalCapacity += uic.get('Capacity');
                    if(uic_hash[uic.get('Project').Name]){
                        uic_hash[uic.get('Project').Name].Users.push({
                                                                        User: userName,
                                                                        children:[],
                                                                        Capacity: uic.get('Capacity'),
                                                                        Estimate: 0,
                                                                        ToDo: 0,
                                                                        PercentageUsedEstimate: 0,
                                                                        PercentageUsedToDo: 0
                                                                    });
                    }else{
                        uic_hash[uic.get('Project').Name] = {
                            Team: uic.get('Project').Name,
                            ObjectID: uic.get('Project').ObjectID,
                            Users: [{
                                        User: userName,
                                        children:[],
                                        Capacity: uic.get('Capacity'),
                                        Estimate: 0,
                                        ToDo: 0,
                                        PercentageUsedEstimate: 0,
                                        PercentageUsedToDo: 0
                                    }]
                        };
                    }


                });

                me.uic_hash = uic_hash;
                // me.logger.log('uic_hash',uic_hash);

                Ext.Array.each(Ext.Object.getKeys(uic_hash),function(team){
                    tasks.push({
                        Team: team,
                        children: me.uic_hash[team].Users,
                        Capacity: 0,
                        Estimate: 0,
                        ToDo: 0,
                        PercentageUsedEstimate: 0,
                        PercentageUsedToDo: 0
                    });
                });

                Ext.Array.each(results[0],function(task){

                    totalToDo = totalToDo + (task.get('ToDo') > 0 ? task.get('ToDo'):0);
                    totalEstimate = totalEstimate + (task.get('Estimate') > 0 ? task.get('Estimate'):0);
                    var userName = task.get('Owner')  ? ((task.get('Owner').FirstName ? task.get('Owner').FirstName : "" ) + " " + (task.get('Owner').LastName ? task.get('Owner').LastName.slice(0,1) : "" )) : "No Owner Entry";
                    if(" "==userName){
                        userName = task.get('Owner')._refObjectName;
                    }
                    var capacity = 0;
                    Ext.Array.each(results[1],function(uic){
                        var task_oid = task.get('Owner') && task.get('Owner').ObjectID ? task.get('Owner').ObjectID:null;
                        var iteration_oid = task.get('Iteration') && task.get('Iteration').ObjectID ? task.get('Iteration').ObjectID:null;
                        if(task_oid == uic.get('User').ObjectID && iteration_oid == uic.get('Iteration').ObjectID){
                            capacity = uic.get('Capacity') ? uic.get('Capacity') : 0;
                        }
                    },me);
                    var teamExists = null;
                    teamExists = Ext.Array.filter(tasks, function(item) {
                        var userExists = null;
                        if(item.Team == task.get('Project').Name){

                            userExists = Ext.Array.filter(item.children, function(child) {
                                if(child.User == userName){
                                    //child.User =  task.get('Owner')._refObjectName,
                                    //child.UserObjectID= task.get('Owner').ObjectID;                                  
                                    child.children.push({
                                        Name: task.get('Name'),
                                        FormattedID: task.get('FormattedID'),
                                        WorkProduct: task.get('WorkProduct').Name,
                                        WorkProductID: task.get('WorkProduct').FormattedID,
                                        State: task.get('State'),
                                        Estimate: task.get('Estimate'),
                                        ToDo: task.get('ToDo'),
                                        leaf: true                                        
                                    });
                                    child.Estimate += task.get('Estimate');
                                    child.ToDo += task.get('ToDo');                                    
                                    child.Capacity = capacity;
                                    child.PercentageUsedEstimate = me._getPercentageUsedEstimate(child.Estimate,child.Capacity);
                                    child.PercentageUsedToDo = me._getPercentageUsedToDo(child.ToDo,child.Capacity);
                                    return true;       
                                }
                            },me);

                            if(userExists.length < 1){
                                //totalCapacity += capacity; 

                                item.children.push({
                                    User: userName,
                                    //UserObjectID: task.get('Owner') ? task.get('Owner').ObjectID:0,
                                    children: [{
                                            Name: task.get('Name'),
                                            FormattedID: task.get('FormattedID'),
                                            WorkProduct: task.get('WorkProduct').Name,
                                            WorkProductID: task.get('WorkProduct').FormattedID,
                                            State: task.get('State'),
                                            Estimate: task.get('Estimate'),
                                            ToDo: task.get('ToDo'),
                                            leaf: true
                                    }],
                                    Capacity: capacity,
                                    Estimate: task.get('Estimate'),
                                    ToDo: task.get('ToDo'),
                                    PercentageUsedEstimate: me._getPercentageUsedEstimate(task.get('Estimate'),capacity),
                                    PercentageUsedToDo: me._getPercentageUsedToDo(task.get('ToDo'),capacity)
                                });
                              
                            }
                            item.Estimate += task.get('Estimate');
                            item.ToDo += task.get('ToDo');                                    
                            item.Capacity =0;
                            item.PercentageUsedEstimate = me._getPercentageUsedEstimate(item.Estimate,item.Capacity); 
                            item.PercentageUsedToDo = me._getPercentageUsedToDo(item.ToDo,item.Capacity);
                            return true;                          
                        }
                    },me);

                    if(teamExists.length < 1){

                        Ext.Array.each(me.uic_hash[task.get('Project').Name].Users,function(user){
                            if(user.User == userName){
                                user.children.push({
                                    Name: task.get('Name'),
                                    FormattedID: task.get('FormattedID'),
                                    WorkProduct: task.get('WorkProduct').Name,
                                    WorkProductID: task.get('WorkProduct').FormattedID,
                                    State: task.get('State'),
                                    Estimate: task.get('Estimate'),
                                    ToDo: task.get('ToDo'),
                                    leaf: true
                                });
                                user.Capacity = capacity;
                                user.Estimate = task.get('Estimate');
                                user.ToDo = task.get('ToDo');
                                user.PercentageUsedEstimate = me._getPercentageUsedEstimate(task.get('Estimate'),capacity);
                                user.PercentageUsedToDo = me._getPercentageUsedToDo(task.get('ToDo'),capacity);
                            }
                        })
                        //totalCapacity += capacity;
                        task = {
                            Team: task.get('Project').Name,
                            children: me.uic_hash[task.get('Project').Name].Users,
                            Capacity: 0,
                            Estimate: task.get('Estimate'),
                            ToDo: task.get('ToDo'),
                            PercentageUsedEstimate: me._getPercentageUsedEstimate(task.get('Estimate'),capacity),                            
                            PercentageUsedToDo: me._getPercentageUsedToDo(task.get('ToDo'),capacity)                      

                        }    
                        tasks.push(task);                    
                    }

                });

                Ext.Array.each(tasks,function(team){
                    var team_capacity = 0;
                    Ext.Array.each(team.children,function(user){
                        team_capacity += user.Capacity;
                    })
                    team.PercentageUsedEstimate = me._getPercentageUsedEstimate(team.Estimate,team_capacity);
                    team.PercentageUsedToDo = me._getPercentageUsedToDo(team.ToDo,team_capacity);
                    team.Capacity = team_capacity;
                });

                me.topProject = me.context.getProject().Name + " - Totals";

                me.tasks = tasks;

                console.log('Tasks>',me.tasks);

                me._create_csv(totalCapacity,totalEstimate, totalToDo );
                
                var store = Ext.create('Ext.data.TreeStore', {
                                model: 'TSModel',
                                root: {
                                    expanded: true,
                                    Team: me.topProject,
                                    children: tasks,
                                    Capacity: totalCapacity,
                                    Estimate: totalEstimate,
                                    ToDo: totalToDo,
                                    PercentageUsedEstimate: me._getPercentageUsedEstimate(totalEstimate,totalCapacity),                                               
                                    PercentageUsedToDo: me._getPercentageUsedToDo(totalToDo,totalCapacity)                                              
                                },
                                sorters:[{
                                    property:'PercentageUsedEstimate',
                                    direction:'DESC'
                                }]
                            });
                //deferred.resolve(store);                    

                me._displayGridNew(store);
                me.setLoading(false);                
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });

    },


    _getPercentageUsedEstimate: function(estimate,capacity){
        var result = 0;
        if(capacity > 0){
            result = Math.round((estimate/capacity)*100);
        }
        return result;
    },


    _getPercentageUsedToDo: function(todo,capacity){
        var result = 0;
        if(capacity > 0){
            result = Math.round((todo/capacity)*100);
        }
        return result;
    },

    //hash = {"Team": { project, Users: [User:{Name: name,Tasks:[task1,task2] }]}} :TODO

    _loadAStoreWithAPromise: function(model_name, model_fields, model_filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        //this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: model_filters,
            context: {
                projectScopeUp: false
            },
            compact: false,
            limit: 'Infinity'
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);                        
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

     _displayGridNew: function(store){
        var me = this
        me.down('#display_box').removeAll();

        var grid = {
            xtype:'treepanel',
            itemId: 'teamTreeGrid',
            store: store,
            cls: 'rally-grid',
            columns: me._getColumns(),
            scroll: true,
            autoScroll:true,
            style: {
                 "border": '1px solid black'
            },
            rootVisible: true
        };

        me.down('#display_box').add(grid);
        me.down('#teamTreeGrid').expandAll();
    },

    _getColumns: function(){
        var me = this;
        return [
                        {
                            xtype:'treecolumn',
                            text: 'Team', 
                            dataIndex: 'Team',
                            flex: 3
                        },
                        {
                            text: 'User', 
                            dataIndex: 'User',
                            flex: 3
                        },
                        {
                            text: 'US ID', 
                            dataIndex: 'WorkProductID',
                            flex: 1
                        },
                        {
                            text: 'US Name', 
                            dataIndex: 'WorkProduct',
                            flex: 3
                        },                        {
                            text: 'Task ID', 
                            dataIndex: 'FormattedID',
                            flex: 1
                        },
                        {
                            text: 'Task Name', 
                            dataIndex: 'Name',
                            flex: 3
                        },
                        {
                            text: 'Task State', 
                            dataIndex: 'State',
                            flex: 2
                        },
                        {
                            text: 'Capacity',
                            dataIndex:'Capacity',
                            renderer: function(Capacity,metaData,record){
                                if(record.get('Team') == me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#A9A9A9;';                                
                                }                                
                                if(record.get('Team')!="" && record.get('Team') != me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#C0C0C0;';                                
                                }
                                if(record.get('User')!=""){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#D3D3D3;';                                
                                }
                                if(record.get('leaf')){
                                    return ""
                                }else{
                                    return Capacity //> 0 ? Capacity:"";
                                }
                            },
                            flex: 1                        
                        },
                        {
                            text: 'Estimate',
                            dataIndex: 'Estimate',
                            renderer: function(Estimate,metaData,record){
                                if(record.get('Team') == me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#A9A9A9;';                                
                                }                                
                                if(record.get('Team')!="" && record.get('Team') != me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#C0C0C0;';                                
                                }
                                if(record.get('User')!=""){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#D3D3D3;';                                
                                }                                   
                                return Estimate // > 0 ? Estimate:"";
                            },
                            flex: 1
                        },
                        {
                            text: 'To Do',
                            dataIndex: 'ToDo',
                            renderer: function(ToDo,metaData,record){
                                if(record.get('Team') == me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#A9A9A9;';                                
                                }                                
                                if(record.get('Team')!="" && record.get('Team') != me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#C0C0C0;';                                
                                }
                                if(record.get('User')!=""){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#D3D3D3;';                                
                                }                                   
                                return ToDo //> 0 ? ToDo:0;
                            },
                            flex: 1
                        },{
                            text: '% Used <BR>(Estimate)',
                            dataIndex: 'PercentageUsedEstimate',
                            renderer: function(PercentageUsedEstimate,metaData,record){
                                if(record.get('Team') == me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#A9A9A9;';                                
                                }                                
                                if(record.get('Team')!="" && record.get('Team') != me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#C0C0C0;';                                
                                }
                                if(record.get('User')!=""){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#D3D3D3;';                                
                                }                              
                                return PercentageUsedEstimate + '%';
                            },
                            flex: 1
                        },
                        {
                            text: '% Used <BR>(To Do)',
                            dataIndex: 'PercentageUsedToDo',
                            renderer: function(PercentageUsedToDo,metaData,record){
                                if(record.get('Team') == me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#A9A9A9;';                                
                                }                                
                                if(record.get('Team')!="" && record.get('Team') != me.context.getProject().Name ){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#C0C0C0;';                                
                                }
                                if(record.get('User')!=""){
                                    metaData.style = 'font-weight: bold;font-style: italic;background-color:#D3D3D3;';                                
                                }                              
                                return PercentageUsedToDo  + '%';
                            },
                            flex: 1
                        }
            ];
    },


    _export: function(){
        var me = this;
        if ( !me.tasks ) { return; }
        
        var filename = Ext.String.format('team_status_by_team.csv');

        Rally.technicalservices.FileUtilities.saveCSVToFile(me.CSV,filename);
    },

    _create_csv: function(totalCapacity,totalEstimate, totalToDo){
        var me = this;

        totals = {
            Team: me.topProject,
            Capacity: totalCapacity,
            Estimate: totalEstimate,
            ToDo: totalToDo,
            PercentageUsedEstimate: me._getPercentageUsedEstimate(totalEstimate,totalCapacity),
            PercentageUsedToDo: me._getPercentageUsedToDo(totalToDo,totalCapacity)                                              
        }


        if ( !me.tasks ) { return; }
        
        me.setLoading("Generating CSV");

        var CSV = "";    
        var row = "";
        // Add the column headers
        var columns = [];
        Ext.Array.each(me._getColumns(),function(col){
            row += col.text.replace("<BR>","") + ',';
            columns.push(col.dataIndex);
        })

        CSV += row + '\r\n';

        //Write the totals row.
        row = "";

        Ext.Array.each(columns,function(col){
            row += totals[col] ? totals[col] + ',':',';
        },me)
        CSV += row + '\r\n';
        // Loop through tasks hash and create the csv 
        Ext.Array.each(me.tasks,function(task){
            row = "";
            Ext.Array.each(columns,function(col){
                row += task[col] ? task[col] + ',':',';
            },me)
            CSV += row + '\r\n';

            if(task.children && task.children.length > 0){
                Ext.Array.each(task.children,function(child){
                    row = "";
                    Ext.Array.each(columns,function(col){
                        row += child[col] ? child[col] + ',':',';
                    },me)
                    CSV += row + '\r\n';

                    if(child.children && child.children.length > 0){
                        Ext.Array.each(child.children,function(gchild){
                            row = "";
                            Ext.Array.each(columns,function(col){
                                if(col == "Name" || col == "WorkProduct"){
                                    row += gchild[col] ? '"' + gchild[col].replace(/"/g, '""') + '"' + ',':',';
                                }else{
                                    row += gchild[col] ? gchild[col] + ',':',';
                                }
                            },me)
                            CSV += row + '\r\n';                             
                        });
                    }
                },me);
            }
        },me);

        me.CSV = CSV;
        me.setLoading(false);
        //me.logger.log(CSV);
    },

    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }
    
});
