Ext.define('TSModel', {
    extend: 'Ext.data.Model',
    fields: [
        { name: 'Team', type:'string' },
        { name: 'User', type:'string' },
        { name: 'FormattedID', type:'string' },
        { name: 'Name', type:'string' },
        { name: 'WorkProduct', type:'string' },
        { name: 'State', type:'string' },
        { name: 'PercentageUsed', type:'string' },
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
        {xtype:'container',itemId:'selector_box'},
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

        var model_name = 'Task',
            field_names = ['ObjectID','FormattedID','Name','Project','State','Owner','WorkProduct','ToDo','Estimate','Iteration','UserIterationCapacities','DisplayName'],
            iteration_field_names = ['ObjectID','FormattedID','Name','Project','Iteration','Capacity','User'],
            filters = [];
        var iteration_name = me.iteration.rawValue;

        filters = [{property:'Iteration.Name',value: iteration_name}];

        Deft.Promise.all([me._loadAStoreWithAPromise(model_name, field_names,filters),me._loadAStoreWithAPromise('UserIterationCapacity', iteration_field_names,filters)],me).then({
            scope: me,
            success: function(results) {
                
                this.logger.log('Query results',results);

                //process results to create a custom grid. 

                var tasks = [];
                //var hash = {},

                Ext.Array.each(results[0],function(task){
                    var capacity = 0;
                    Ext.Array.each(results[1],function(uic){
                        var task_oid = task.get('Owner') && task.get('Owner').ObjectID ? task.get('Owner').ObjectID:null;
                        var iteration_oid = task.get('Iteration') && task.get('Iteration').ObjectID ? task.get('Iteration').ObjectID:null;
                        if(task_oid == uic.get('User').ObjectID && iteration_oid == uic.get('Iteration').ObjectID){
                            capacity = uic.get('Capacity') ? uic.get('Capacity') : 0;
                            me.logger.log('uic now',task.get('Owner').DisplayName, uic.get('Capacity'));
                        }
                    },me);

                    var teamExists = null;
                    teamExists = Ext.Array.filter(tasks, function(item) {
                        var userExists = null;
                        if(item.Team == task.get('Project').Name){

                            userExists = Ext.Array.filter(item.children, function(child) {
                                if(child.User == task.get('Owner').DisplayName){
                                    child.children.push({
                                        Name: task.get('Name'),
                                        FormattedID: task.get('FormattedID'),
                                        WorkProduct: task.get('WorkProduct').Name,
                                        State: task.get('State'),
                                        Estimate: task.get('Estimate'),
                                        ToDo: task.get('ToDo'),
                                        leaf: true                                        
                                    });
                                    child.Estimate += task.get('Estimate');
                                    child.ToDo += task.get('ToDo');                                    
                                    child.Capacity = capacity;
                                    child.PercentageUsed = child.Capacity > 0 ? (child.Estimate/child.Capacity)*100:0;
                                    //child.PercentageUsed = capacity > 0 ? (task.get('Estimate')/capacity)*100:0;
                                    return true;       

                                }
                            },me);

                            if(userExists.length < 1){

                                item.children.push({
                                    User: task.get('Owner').DisplayName,
                                    children: [{
                                            Name: task.get('Name'),
                                            FormattedID: task.get('FormattedID'),
                                            WorkProduct: task.get('WorkProduct').Name,
                                            State: task.get('State'),
                                            Estimate: task.get('Estimate'),
                                            ToDo: task.get('ToDo'),
                                            leaf: true
                                    }],
                                    Capacity: capacity,
                                    Estimate: task.get('Estimate'),
                                    ToDo: task.get('ToDo'),
                                    PercentageUsed: capacity > 0 ? (task.get('Estimate')/capacity)*100:0,
                                });
                              
                            }
                            item.Estimate += task.get('Estimate');
                            item.ToDo += task.get('ToDo');                                    
                            item.Capacity += capacity;
                            item.PercentageUsed = item.Capacity > 0 ? (item.Estimate/item.Capacity)*100:0;    

                            return true;                          
                        }
                    },me);

                    if(teamExists.length < 1){
                        task = {
                            Team: task.get('Project').Name,
                            children: [{
                                User: task.get('Owner').DisplayName,
                                children: [{
                                    Name: task.get('Name'),
                                    FormattedID: task.get('FormattedID'),
                                    WorkProduct: task.get('WorkProduct').Name,
                                    State: task.get('State'),
                                    Estimate: task.get('Estimate'),
                                    ToDo: task.get('ToDo'),
                                    leaf: true
                                }],
                                Capacity: capacity,
                                Estimate: task.get('Estimate'),
                                ToDo: task.get('ToDo'),
                                PercentageUsed: capacity > 0 ? (task.get('Estimate')/capacity)*100:0
                            }],
                            Capacity: capacity,
                            Estimate: task.get('Estimate'),
                            ToDo: task.get('ToDo'),
                            PercentageUsed: capacity > 0 ? (task.get('Estimate')/capacity)*100:0                            

                        }    
                        tasks.push(task);                    
                    }


                    
                    // task = {
                    //     Team: task.get('Project').Name,
                    //     User: task.get('Owner').DisplayName,
                    //     Name: task.get('Name'),
                    //     FormattedID: task.get('FormattedID'),
                    //     WorkProduct: task.get('WorkProduct').Name,
                    //     State: task.get('State'),
                    //     PercentageUsed: capacity > 0 ? (task.get('Estimate')/capacity)*100:0,
                    //     Capacity: capacity,
                    //     Estimate: task.get('Estimate'),
                    //     ToDo: task.get('ToDo')
                    // }

                    //tasks.push(task);
                });

                // //{ "iteration 1": { "records": { "av": [o,o,o] } , { "pv": [o,o,o] } } }
                // //{ "Team A": {"User A": [task,task,task]}}
                // var hash = {};

                // Ext.Array.each(tasks, function(task){
                //     var team = task.Team;
                //     // var name = task.Name;
                //     // var taskHash = {};
                //     // taskHash[name] = [];
                //     if ( Ext.isEmpty(hash[team])){
                //         hash[team] = {Team: team,children};
                //     }
                //     hash[team] = ;
                // });

                // var store = Ext.create('Rally.data.custom.Store', {
                //     data: tasks,
                //     scope: me
                // });


                var store = Ext.create('Ext.data.TreeStore', {
                                model: 'TSModel',
                                root: {
                                    expanded: true,
                                    children: tasks
                                }
                            });



                //deferred.resolve(store);                    

                me._displayGridNew(store);
            },
            failure: function(error_message){
                alert(error_message);
            }
        }).always(function() {
            me.setLoading(false);
        });

    },

    //hash = {"Team": { project, Users: [User:{Name: name,Tasks:[task1,task2] }]}} :TODO

    _loadAStoreWithAPromise: function(model_name, model_fields, model_filters){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields,
            filters: model_filters
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

    
    // _displayGrid: function(store,field_names){
    //     this.down('#display_box').removeAll();

    //     var grid = {
    //         xtype: 'rallygrid',
    //         store: store,
    //         showRowActionsColumn: false,
    //         columnCfgs: [
    //                     {
    //                         text: 'Team', 
    //                         dataIndex: 'Team',
    //                         flex:1
    //                     },
    //                     {
    //                         text: 'User', 
    //                         dataIndex: 'User'
    //                     },
    //                     {
    //                         text: 'FormattedID', 
    //                         dataIndex: 'FormattedID'
    //                     },
    //                     {
    //                         text: 'Name', 
    //                         dataIndex: 'Name'
    //                     },
    //                     {
    //                         text: 'Work Product', 
    //                         dataIndex: 'WorkProduct'
    //                     },
    //                     {
    //                         text: 'State', 
    //                         dataIndex: 'State'
    //                     },
    //                     {
    //                         text: '% Used',
    //                         dataIndex: 'PercentageUsed',
    //                         renderer: function(value){
    //                             return Ext.util.Format.number(value,'0.00') + "%";
    //                         }
    //                     },
    //                     {
    //                         text: 'Capacity',
    //                         dataIndex:'Capacity'
    //                     },
    //                     {
    //                         text: 'Estimate',
    //                         dataIndex: 'Estimate'
    //                     },
    //                     {
    //                         text: 'To Do',
    //                         dataIndex: 'ToDo'
    //                     }
    //                     ]
    //     };

    //     this.down('#display_box').add(grid);

    // },



    _displayGridNew: function(store){
        var me = this
        me.down('#display_box').removeAll();

        var grid = {
            xtype:'treepanel',
            title: 'Team Status By Team',
            itemId: 'teamTreeGrid',
            store: store,
            cls: 'rally-grid',
            columns: [
                        {
                            xtype:'treecolumn',
                            text: 'Team', 
                            dataIndex: 'Team',
                            flex: 1
                        },
                        {
                            text: 'User', 
                            dataIndex: 'User',
                            flex: 1
                        },
                        {
                            text: 'FormattedID', 
                            dataIndex: 'FormattedID'
                        },
                        {
                            text: 'Name', 
                            dataIndex: 'Name'
                        },
                        {
                            text: 'Work Product', 
                            dataIndex: 'WorkProduct'
                        },
                        {
                            text: 'State', 
                            dataIndex: 'State'
                        },
                        {
                            text: '% Used',
                            dataIndex: 'PercentageUsed',
                            renderer: function(PercentageUsed,metaData,record){
                                if(!record.get('leaf')){
                                    metaData.style = 'font-weight: bold;font-style: italic;';                                
                                }
                                return PercentageUsed ? Ext.util.Format.number(PercentageUsed,'0.00') + "%":"";
                            }
                        },
                        {
                            text: 'Capacity',
                            dataIndex:'Capacity',
                            renderer: function(Capacity,metaData,record){
                                if(!record.get('leaf')){
                                    metaData.style = 'font-weight: bold;font-style: italic;';                                
                                }
                                return Capacity > 0 ? Capacity:"";
                            }                            
                        },
                        {
                            text: 'Estimate',
                            dataIndex: 'Estimate',
                            renderer: function(Estimate,metaData,record){
                                if(!record.get('leaf')){
                                    metaData.style = 'font-weight: bold;font-style: italic;';                                
                                }
                                return Estimate > 0 ? Estimate:"";
                            }
                        },
                        {
                            text: 'To Do',
                            dataIndex: 'ToDo',
                            renderer: function(ToDo,metaData,record){
                                if(!record.get('leaf')){
                                    metaData.style = 'font-weight: bold;font-style: italic;';                                
                                }
                                return ToDo > 0 ? ToDo:"";
                            }
                        }
            ],
            
            rootVisible: false
        };

        me.down('#display_box').add(grid);
        me.down('#teamTreeGrid').expandAll();
    },

    _export: function(){
        var grid = this.down('#teamTreeGrid');
        var me = this;

        if ( !grid ) { return; }
        
        this.logger.log('_export',grid);

        var filename = Ext.String.format('dependency-snapsot.csv');

        this.setLoading("Generating CSV");
        Deft.Chain.sequence([
            function() { return Rally.technicalservices.FileUtilities._getCSVFromCustomBackedGrid(grid) } 
        ]).then({
            scope: this,
            success: function(csv){
                if (csv && csv.length > 0){
                    Rally.technicalservices.FileUtilities.saveCSVToFile(csv,filename);
                } else {
                    Rally.ui.notify.Notifier.showWarning({message: 'No data to export'});
                }
                
            }
        }).always(function() { me.setLoading(false); });
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
